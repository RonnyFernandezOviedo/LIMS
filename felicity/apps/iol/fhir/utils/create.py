import logging

from fastapi import Request

from apps.iol.fhir.schema import (
    DiagnosticReportResource,
    PatientResource,
    BundleResource,
    ServiceRequestResource,
    Reference,
)
from apps.job import conf as job_conf
from apps.job.models import Job
from apps.job.schemas import JobCreate
from apps.shipment.conf import shipment_states
from apps.shipment.models import Shipment, ReferralLaboratory
from apps.shipment.schemas import ShipmentCreate
from apps.user.models import User

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def create_resource(
        resource_type: str,
        resource_data: BundleResource
                       | PatientResource
                       | ServiceRequestResource
                       | DiagnosticReportResource,
        request: Request,
        current_user: User,
):
    logger.info(f"create resource {resource_type} ..................")
    resource_mappings = {
        "Bundle": create_bundle,
        "DiagnosticReport": create_diagnostic_report,
    }
    if not resource_type in resource_mappings:
        return False
    return await resource_mappings[resource_type](resource_data, request, current_user)


async def create_bundle(
        resource_data: BundleResource, request: Request, current_user: User
):
    logger.info(f"Bundle data: ........")
    if resource_data.extension[0].valueString == "shipment":
        await create_inbound_shipment(resource_data, request, current_user)

    return True


async def create_inbound_shipment(
        payload: BundleResource, request: Request, current_user: User
):
    """Create inbound shipment from bundle"""
    logger.info(f"Incoming Inbound shipment ....")

    data = payload.dict(exclude_none=True)

    laboratory = await resolve_ref_laboratory(payload.identifier.assigner, request)

    s_in = ShipmentCreate(
        comment=payload.extension[2].valueString,
        courier=payload.extension[1].valueString,
        assigned_count=payload.total,
        laboratory_uid=laboratory.uid,
        data=data,
        incoming=True,
        state=shipment_states.DUE,
    )
    shipment = await Shipment.create(s_in)

    try:
        from apps.shipment.utils import gen_pdf_manifest

        await gen_pdf_manifest(payload.extension[3].data.get("data", None), shipment)
    except Exception:
        pass


async def resolve_ref_laboratory(ref: Reference, request: Request):
    referral = await ReferralLaboratory.get(code=ref.identifier.value)
    if referral:
        return referral
    return await ReferralLaboratory.create(
        {
            "name": ref.display,
            "code": ref.identifier.value,
            "url": request.headers.get("host", ""),
            "is_reference": True,
            "is_referral": False,
            "username": "changeme",
            "password": "changeme",
        }
    )


async def create_diagnostic_report(
        diagnostic_data: DiagnosticReportResource, request: Request, current_user: User
):
    job_schema = JobCreate(
        action=job_conf.actions.DIAGNOSTIC_REPORT,
        category=job_conf.categories.SHIPMENT,
        priority=job_conf.priorities.MEDIUM,
        job_id=0,
        status=job_conf.states.PENDING,
        creator_uid=current_user.uid,
        data={"data": diagnostic_data.dict(exclude_none=True)},
    )
    await Job.create(job_schema)

    return True
