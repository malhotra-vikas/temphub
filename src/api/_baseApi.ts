import { reset } from "@redux/slices/popup.slice";
import { logout } from "@redux/slices/userSlice";
import { RemoveDuplicateToast } from "@utils/helper";
import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import store from "../redux/store";
import { signInWithCustomToken } from "firebase/auth";
import { auth } from "../../firebaseConfig"; // ✅ Import the initialized Firebase instance

interface KeycloakUser {
  access_token: string;
}

interface User {
  keycloak_user: KeycloakUser;
  firebase_token: string;
}

export default class BaseApi {
  private static isInterceptorSet = false;
  private static isHandlingError = false;

  private static setInterceptor() {
    if (!BaseApi.isInterceptorSet) {
      axios.interceptors.response.use(
        (response: AxiosResponse) => response,
        async (error: any) => {
          if (
            error.response?.status === 401 &&
            (error.response?.data?.message === "Session Expired!" ||
              error.response?.data?.message ===
                "Invalid token - decoding error" ||
              error.response?.data?.message === "Authorization token missing" ||
              error.response?.data?.message === "User not in our system" ||
              error.response?.data?.message === "Unauthorized User Access!")
          ) {
            if (!BaseApi.isHandlingError) {
              BaseApi.isHandlingError = true;

              BaseApi.isHandlingError = false;
              RemoveDuplicateToast(
                error.response?.data?.message,
                "session-expired-toast",
              );

              const dispatch = store.dispatch;
              dispatch(logout());
              dispatch(reset());
            }
          }
          return Promise.reject(error);
        },
      );

      BaseApi.isInterceptorSet = true;
    }
  }

  static async exchangeCustomToken(
    customToken: string,
  ): Promise<string | null> {
    try {
      const userCredential = await signInWithCustomToken(auth, customToken);
      const idToken = await userCredential.user.getIdToken();
      console.log("✅ Successfully exchanged for ID Token:");
      return idToken;
    } catch (error) {
      console.error("❌ Error exchanging custom token:", error);
      return null;
    }
  }

  private static async mergeRequestConfig(
    config?: AxiosRequestConfig,
  ): Promise<AxiosRequestConfig<any>> {
    const baseConfig: AxiosRequestConfig = {
      baseURL: import.meta.env.VITE_REACT_APP_SERVER_URL,
      headers: {},
    };

    const user = store.getState().user?.user as User | null;
    const firebaseToken = user?.firebase_token;

    if (firebaseToken) {
      const idToken = await BaseApi.exchangeCustomToken(firebaseToken);
      if (idToken) {
        baseConfig.headers!["Authorization"] = `Bearer ${idToken}`;
      }
    }
    return { ...baseConfig, ...config };
  }

  static async post(url: string, body: any, config?: AxiosRequestConfig) {
    BaseApi.setInterceptor();
    const finalConfig = await BaseApi.mergeRequestConfig(config); // ✅ Await here
    console.log("calling backend at ", url);
    return axios.post(url, body, finalConfig);
  }

  static async get(url: string, config?: AxiosRequestConfig) {
    BaseApi.setInterceptor();
    const finalConfig = await BaseApi.mergeRequestConfig(config); // ✅ Await here
    console.log("calling backend at ", url);

    return axios.get(url, finalConfig);
  }

  static async patch(url: string, body: any, config?: AxiosRequestConfig) {
    BaseApi.setInterceptor();
    const finalConfig = await BaseApi.mergeRequestConfig(config); // ✅ Await here
    console.log("calling backend at ", url);

    return axios.patch(url, body, finalConfig);
  }

  static async put(url: string, body: any, config?: AxiosRequestConfig) {
    BaseApi.setInterceptor();
    const finalConfig = await BaseApi.mergeRequestConfig(config); // ✅ Await here
    console.log("calling backend at ", url);

    return axios.put(url, body, finalConfig);
  }

  static async delete(url: string, body?: any, config?: AxiosRequestConfig) {
    BaseApi.setInterceptor();
    const finalConfig = await BaseApi.mergeRequestConfig(config); // ✅ Await here
    if (body) finalConfig.data = body;
    console.log("calling backend at ", url);

    return axios.delete(url, finalConfig);
  }
}
