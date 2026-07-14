import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotificationBell } from "@/components/layout/notification-bell";

type Notification = {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: string;
};

function mockFetch(payload: { notifications: Notification[]; unreadCount: number }) {
  return vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === "PATCH") {
      return { ok: true, json: async () => ({}) } as Response;
    }
    return { ok: true, json: async () => payload } as Response;
  });
}

const NOTIFS: Notification[] = [
  {
    id: "n1",
    title: "Document approved",
    message: "Your passport was approved",
    type: "INFO",
    read: false,
    createdAt: "2026-01-05T12:00:00Z",
  },
];

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("NotificationBell", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch({ notifications: [], unreadCount: 0 }));
  });

  it("renders the bell button without a badge when there are no unread items", async () => {
    render(<NotificationBell />);
    expect(screen.getByRole("button", { name: /notifications/i })).toBeInTheDocument();
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/notifications"));
    expect(screen.queryByText("9+")).not.toBeInTheDocument();
  });

  it("shows the exact unread count up to nine", async () => {
    vi.stubGlobal("fetch", mockFetch({ notifications: [], unreadCount: 3 }));
    render(<NotificationBell />);
    await waitFor(() => expect(screen.getByText("3")).toBeInTheDocument());
  });

  it("caps the unread badge at 9+", async () => {
    vi.stubGlobal("fetch", mockFetch({ notifications: [], unreadCount: 15 }));
    render(<NotificationBell />);
    await waitFor(() => expect(screen.getByText("9+")).toBeInTheDocument());
  });

  it("opens a fixed-position dropdown listing notifications", async () => {
    vi.stubGlobal("fetch", mockFetch({ notifications: NOTIFS, unreadCount: 1 }));
    render(<NotificationBell />);
    await waitFor(() => expect(screen.getByText("1")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: /notifications/i }));

    const heading = await screen.findByText("Notifications");
    const panel = heading.closest("div.fixed");
    expect(panel).not.toBeNull();
    expect(screen.getByText("Document approved")).toBeInTheDocument();
    expect(screen.getByText("Your passport was approved")).toBeInTheDocument();
  });

  it("shows an empty state when there are no notifications", async () => {
    render(<NotificationBell />);
    await userEvent.click(screen.getByRole("button", { name: /notifications/i }));
    expect(await screen.findByText("No notifications")).toBeInTheDocument();
  });

  it("marks all read and reloads", async () => {
    const fetchMock = mockFetch({ notifications: NOTIFS, unreadCount: 2 });
    vi.stubGlobal("fetch", fetchMock);
    render(<NotificationBell />);
    await waitFor(() => expect(screen.getByText("2")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: /notifications/i }));
    await userEvent.click(await screen.findByRole("button", { name: /mark all read/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/notifications",
        expect.objectContaining({ method: "PATCH" })
      )
    );
  });

  it("closes the dropdown when clicking outside", async () => {
    render(
      <div>
        <NotificationBell />
        <button type="button">outside</button>
      </div>
    );
    await userEvent.click(screen.getByRole("button", { name: /notifications/i }));
    expect(await screen.findByText("No notifications")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "outside" }));
    await waitFor(() =>
      expect(screen.queryByText("No notifications")).not.toBeInTheDocument()
    );
  });

  it("ignores a failed notifications fetch without crashing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, json: async () => ({}) }) as Response)
    );
    render(<NotificationBell />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(screen.queryByText("9+")).not.toBeInTheDocument();
  });
});
