import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { IUser } from '../models/auth';
import { STORAGE_AUTH_KEY, USER_GROUP_OVERRIDE } from '../conf';
import { AUTHENTICATE_USER, REFRESH_TOKEN } from '../graphql/operations/_mutations';
import { useAuthenticateUserMutation } from '../graphql/graphql';
import { useNotifyToast, useApiUtil, userPreferenceComposable } from '../composables';
import { userInfo } from 'os';
import jwtDecode from 'jwt-decode';

const { withClientMutation } = useApiUtil();
const { toastInfo } = useNotifyToast();
const { initPreferences } = userPreferenceComposable();

interface IAuth {
    token?: string;
    refresh?: string;
    tokenType?: string;
    user?: IUser;
    isAuthenticated: boolean;
    authenticating: boolean;
    refreshTokenTimeout: any;
}

export const useAuthStore = defineStore('auth', () => {
    const router = useRouter()
    const initialState: IAuth = {
        user: undefined,
        token: '',
        refresh: '',
        tokenType: '',
        isAuthenticated: false,
        authenticating: false,
        refreshTokenTimeout: undefined,
    };

    const auth = ref({ ...initialState });

    const resetState = () => (auth.value = { ...initialState });

    const reset = () => {
        localStorage.removeItem(STORAGE_AUTH_KEY);
        stopRefreshTokenTimer()
        resetState();
    };

    const logout = () => {
        toastInfo('Good bye ' + auth.value.user?.firstName);
        reset();
    };

    const upsertPermission = () => {
        if (USER_GROUP_OVERRIDE.length > 0) {
            auth.value.user?.groups?.forEach(group => ({
                ...group,
                name: USER_GROUP_OVERRIDE,
            }));
        }
    };

    if (localStorage.getItem(STORAGE_AUTH_KEY)) {
        const data = JSON.parse(localStorage.getItem(STORAGE_AUTH_KEY)!);
        auth.value = {
            ...auth.value,
            ...data,
            isAuthenticated: true,
            authenticating: false,
        };
        upsertPermission();
    } else {
        // logout()
    }

    watch(() => auth.value, authValue => {
        if (authValue?.user && authValue?.token) {
            localStorage.setItem(STORAGE_AUTH_KEY, JSON.stringify(authValue));
            upsertPermission();
            // startRefreshTokenTimer();
        }
    });

    const persistAuth = async data => {
        auth.value = data;
        auth.value.isAuthenticated = true;
        auth.value.authenticating = false;
    };

    const authenticate = async payload => {
        auth.value.authenticating = true;

        // typescript-urql
        // const [{ data, fetching, error }, authenticate]  = useAuthenticateUserMutation();
        // authenticate({password: "", username: ""})
        // auth.value.authenticating = fetching;

        // typescript-vue-urql
        // useAuthenticateUserMutation().executeMutation({username: "", password: ""}, {requestPolicy: "network-only"}).then(res => {
        //     console.log(res)
        // }).catch(err => {
        //     console.log(err)
        // }).finally(() => (auth.value.authenticating = false));

        // const { operation } = useAuthenticateUserMutation({username: "", password: ""});
        
        await withClientMutation(AUTHENTICATE_USER, payload, 'authenticateUser')
            .then(res => {
                if(!res) {
                    auth.value.authenticating = false;
                    return
                };
                persistAuth(res);
            })
            .catch(err => (auth.value.authenticating = false));
    };

    const refreshToken = async (): Promise<void> => {
        console.log("refreshing tken");
        await withClientMutation(REFRESH_TOKEN, { refreshToken: auth.value.refresh }, 'refresh')
        .then(res => {
            if(!res) {
                return
            };
            persistAuth(res);
        })
        .catch(err => (auth.value.authenticating = false));
    };

    const startRefreshTokenTimer = async () => {

        const decodedToken: any = jwtDecode(auth.value.token!)
        // refresh the token a minute before it expires
        const expires = new Date(+(decodedToken.exp) * 1000);
        console.log("expires: ", expires);
        const timeout = expires.getTime() - Date.now() - (60 * 1000);
        console.log("timeout: ", timeout);
        //
        auth.value.refreshTokenTimeout = setTimeout(() => {
            refreshToken()
        }, timeout);
    };

    const stopRefreshTokenTimer = () => {
        clearTimeout(auth.value.refreshTokenTimeout);
    }

    return {
        auth,
        authenticate,
        reset,
        persistAuth,
        logout
    };
});
