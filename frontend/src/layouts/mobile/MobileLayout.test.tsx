import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestQueryClient, renderWithQueryClient } from "@/test/query-test-utils";
import MobileLayout from "./MobileLayout";
import { reloadMobileLayout } from "./mobile-refresh";

vi.mock("./mobile-refresh", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./mobile-refresh")>()),
  reloadMobileLayout: vi.fn(),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const fetchCampaign = vi.fn<(campaignId: number) => Promise<string>>();
const onPageMount = vi.fn();

function CampaignPage({ campaignId }: { campaignId: number }) {
  const { data } = useQuery({
    queryKey: ["campaign", campaignId, "detail"],
    queryFn: () => fetchCampaign(campaignId),
    staleTime: 30_000, // like the app default, so a remount reads the cache
  });
  useEffect(() => {
    onPageMount();
  }, []);
  return <div>{data ?? "loading"}</div>;
}

function getScrollContainer(scrollTop = 0) {
  const scrollContainer = screen.getByTestId("mobile-layout-scroll");
  Object.defineProperty(scrollContainer, "scrollTop", {
    configurable: true,
    value: scrollTop,
    writable: true,
  });
  return scrollContainer;
}

function pull(scrollContainer: HTMLElement, distance: number) {
  fireEvent.touchStart(scrollContainer, { touches: [{ clientY: 0 }] });
  fireEvent.touchMove(scrollContainer, { touches: [{ clientY: distance }] });
}

describe("MobileLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchCampaign.mockImplementation(async (campaignId) => `Campaign ${campaignId}`);
  });

  it("refetches the campaign's queries instead of reloading when pulled past the threshold", async () => {
    renderWithQueryClient(
      <MobileLayout campaignId={7}>
        <CampaignPage campaignId={7} />
        <CampaignPage campaignId={8} />
      </MobileLayout>
    );
    expect(await screen.findByText("Campaign 7")).toBeInTheDocument();
    expect(await screen.findByText("Campaign 8")).toBeInTheDocument();
    const refetch = deferred<string>();
    fetchCampaign.mockImplementation(async (campaignId) =>
      campaignId === 7 ? refetch.promise : `Campaign ${campaignId}`
    );

    const scrollContainer = getScrollContainer();
    pull(scrollContainer, 260);
    expect(screen.getByText("Release to refresh")).toBeInTheDocument();
    fireEvent.touchEnd(scrollContainer);

    // "Refreshing..." stays up until the campaign's queries have refetched.
    expect(screen.getByText("Refreshing...")).toBeInTheDocument();
    await waitFor(() => expect(fetchCampaign).toHaveBeenCalledTimes(3));
    expect(fetchCampaign).toHaveBeenLastCalledWith(7);

    await act(async () => refetch.resolve("Campaign 7 (updated)"));

    expect(await screen.findByText("Campaign 7 (updated)")).toBeInTheDocument();
    expect(screen.queryByText("Refreshing...")).not.toBeInTheDocument();
    expect(reloadMobileLayout).not.toHaveBeenCalled();
  });

  it("refetches every query outside a campaign", async () => {
    renderWithQueryClient(
      <MobileLayout>
        <CampaignPage campaignId={7} />
        <CampaignPage campaignId={8} />
      </MobileLayout>
    );
    await screen.findByText("Campaign 8");

    const scrollContainer = getScrollContainer();
    pull(scrollContainer, 260);
    fireEvent.touchEnd(scrollContainer);

    await waitFor(() => expect(fetchCampaign).toHaveBeenCalledTimes(4));
    await waitFor(() => expect(screen.queryByText("Refreshing...")).not.toBeInTheDocument());
  });

  it("remounts the page after refreshing, without repeating the refetched queries", async () => {
    renderWithQueryClient(
      <MobileLayout campaignId={7}>
        <CampaignPage campaignId={7} />
      </MobileLayout>
    );
    await screen.findByText("Campaign 7");
    expect(onPageMount).toHaveBeenCalledTimes(1);

    const scrollContainer = getScrollContainer();
    pull(scrollContainer, 260);
    fireEvent.touchEnd(scrollContainer);

    await waitFor(() => expect(onPageMount).toHaveBeenCalledTimes(2));
    expect(fetchCampaign).toHaveBeenCalledTimes(2);
  });

  it("falls back to a full reload only if refetching throws", async () => {
    const queryClient = createTestQueryClient();
    vi.spyOn(queryClient, "invalidateQueries").mockRejectedValue(new Error("boom"));
    renderWithQueryClient(
      <MobileLayout campaignId={7}>
        <div>Campaign content</div>
      </MobileLayout>,
      { queryClient }
    );

    const scrollContainer = getScrollContainer();
    pull(scrollContainer, 260);
    fireEvent.touchEnd(scrollContainer);

    await waitFor(() => expect(reloadMobileLayout).toHaveBeenCalledTimes(1));
  });

  it("ignores slight pull gestures at the top", () => {
    const queryClient = createTestQueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    renderWithQueryClient(
      <MobileLayout campaignId={7}>
        <div>Campaign content</div>
      </MobileLayout>,
      { queryClient }
    );

    const scrollContainer = getScrollContainer();
    pull(scrollContainer, 20);
    fireEvent.touchEnd(scrollContainer);

    expect(screen.queryByText("Pull to refresh")).not.toBeInTheDocument();
    expect(screen.queryByText("Release to refresh")).not.toBeInTheDocument();
    expect(invalidate).not.toHaveBeenCalled();
    expect(reloadMobileLayout).not.toHaveBeenCalled();
  });

  it("does not refresh when the list is not at the top", () => {
    const queryClient = createTestQueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    renderWithQueryClient(
      <MobileLayout campaignId={7}>
        <div>Campaign content</div>
      </MobileLayout>,
      { queryClient }
    );

    const scrollContainer = getScrollContainer(24);
    pull(scrollContainer, 260);
    fireEvent.touchEnd(scrollContainer);

    expect(invalidate).not.toHaveBeenCalled();
    expect(reloadMobileLayout).not.toHaveBeenCalled();
  });
});
