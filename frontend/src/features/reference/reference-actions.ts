import { createContext, useContext, type ReactNode } from "react";

/**
 * A reference page's own buttons (Add new) on a phone, which its search box shows beside it
 * (William, 22 Nov 2026: "On mobile, reference pages can the search bar be inline with the add
 * button"). Null on the web, where they sit beside the title.
 */
export const ReferenceActionsContext = createContext<ReactNode>(null);

export const useReferenceActions = () => useContext(ReferenceActionsContext);
