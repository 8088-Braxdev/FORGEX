export type ConnectivityState = {
  online: boolean;
  failures: number;
};

export const INITIAL_CONNECTIVITY: ConnectivityState = {
  online: true,
  failures: 0,
};

export type ConnectivityTransition = "none" | "toOffline" | "toOnline";

const FAILURE_THRESHOLD = 2;

export function connectivityTransition(
  state: ConnectivityState,
  event: "success" | "failure" | "navigator-online" | "navigator-offline",
): { state: ConnectivityState; transition: ConnectivityTransition } {
  switch (event) {
    case "success":
      if (!state.online) {
        return { state: { online: true, failures: 0 }, transition: "toOnline" };
      }
      return { state: { online: true, failures: 0 }, transition: "none" };

    case "failure": {
      const failures = state.failures + 1;
      if (state.online && failures >= FAILURE_THRESHOLD) {
        return {
          state: { online: false, failures },
          transition: "toOffline",
        };
      }
      return { state: { ...state, failures }, transition: "none" };
    }

    case "navigator-online":
      if (!state.online) {
        return { state: { online: true, failures: 0 }, transition: "toOnline" };
      }
      return { state: { online: true, failures: 0 }, transition: "none" };

    case "navigator-offline": {
      const failures = state.failures + 1;
      if (state.online && failures >= FAILURE_THRESHOLD) {
        return {
          state: { online: false, failures },
          transition: "toOffline",
        };
      }
      return { state: { ...state, failures }, transition: "none" };
    }
  }
}