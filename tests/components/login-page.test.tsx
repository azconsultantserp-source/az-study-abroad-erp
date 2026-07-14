import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const nav = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  get: vi.fn<(key: string) => string | null>(() => null),
}));

vi.mock("next-auth/react", () => ({ signIn: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push, refresh: nav.refresh }),
  useSearchParams: () => ({ get: nav.get }),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={typeof src === "string" ? src : ""} alt={alt} />
  ),
}));

import LoginPage from "@/app/login/page";
import { signIn } from "next-auth/react";

const signInMock = signIn as unknown as ReturnType<typeof vi.fn>;

async function fillAndSubmit() {
  await userEvent.type(screen.getByLabelText("Login ID"), "user@example.com");
  await userEvent.type(screen.getByLabelText("Password"), "secret1");
  await userEvent.click(screen.getByRole("button", { name: /sign in to portal/i }));
}

beforeEach(() => {
  nav.push.mockReset();
  nav.refresh.mockReset();
  nav.get.mockReset().mockReturnValue(null);
  signInMock.mockReset();
});

describe("LoginPage", () => {
  it("renders the sign-in form", () => {
    render(<LoginPage />);
    expect(screen.getByRole("heading", { name: /welcome back/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Login ID")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("toggles password visibility", async () => {
    render(<LoginPage />);
    const password = screen.getByLabelText("Password");
    expect(password).toHaveAttribute("type", "password");
    await userEvent.click(screen.getByRole("button", { name: /show password/i }));
    expect(password).toHaveAttribute("type", "text");
    await userEvent.click(screen.getByRole("button", { name: /hide password/i }));
    expect(password).toHaveAttribute("type", "password");
  });

  it("shows an alert when sign-in is not ok", async () => {
    signInMock.mockResolvedValueOnce({ ok: false, error: null });
    render(<LoginPage />);
    await fillAndSubmit();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/invalid email or password/i);
    expect(nav.push).not.toHaveBeenCalled();
  });

  it("shows an alert when sign-in returns an error", async () => {
    signInMock.mockResolvedValueOnce({ ok: true, error: "CredentialsSignin" });
    render(<LoginPage />);
    await fillAndSubmit();

    expect(await screen.findByRole("alert")).toHaveTextContent(/invalid email or password/i);
    expect(nav.push).not.toHaveBeenCalled();
  });

  it("shows an alert when sign-in throws", async () => {
    signInMock.mockRejectedValueOnce(new Error("network down"));
    render(<LoginPage />);
    await fillAndSubmit();

    expect(await screen.findByRole("alert")).toHaveTextContent(/invalid email or password/i);
  });

  it("redirects to the callback URL on success", async () => {
    signInMock.mockResolvedValueOnce({ ok: true, error: null });
    nav.get.mockImplementation((key: string) =>
      key === "callbackUrl" ? "/students/all" : null
    );
    render(<LoginPage />);
    await fillAndSubmit();

    await waitFor(() => expect(nav.push).toHaveBeenCalledWith("/students/all"));
    expect(nav.refresh).toHaveBeenCalled();
  });

  it("falls back to /dashboard for an unsafe callback URL", async () => {
    signInMock.mockResolvedValueOnce({ ok: true, error: null });
    nav.get.mockImplementation((key: string) =>
      key === "callbackUrl" ? "https://evil.com" : null
    );
    render(<LoginPage />);
    await fillAndSubmit();

    await waitFor(() => expect(nav.push).toHaveBeenCalledWith("/dashboard"));
  });

  it("shows the inactivity banner when timed out", () => {
    nav.get.mockImplementation((key: string) => (key === "reason" ? "timeout" : null));
    render(<LoginPage />);
    expect(screen.getByText(/signed out due to inactivity/i)).toBeInTheDocument();
  });
});
