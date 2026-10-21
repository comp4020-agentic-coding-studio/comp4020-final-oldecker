// The house page's one EventSource, shared by every script that listens to
// it (live.ts for the corridor/plant/wall/party room, front-door.ts for
// knocks). A module of its own rather than living in live.ts, so it's a
// shared chunk that runs exactly once --- two `new EventSource` calls would
// open two connections and count this tab twice in the corridor.
import { houseUrl } from "./house-context";

export const source = new EventSource(houseUrl("/api/events"));
