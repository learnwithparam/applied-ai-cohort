// The one page a member opens: the spray desk jobs board. The store starts empty after
// `uv run world reset`, so this route is the empty-store view.
export type Route = { name: string; path: string };

export const routes: Route[] = [{ name: "jobs board, empty store", path: "/" }];

// Button verbs this course uses beyond the shared list, in lower case.
export const extraButtonVerbs: string[] = [];
