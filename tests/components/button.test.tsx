import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("renders its children", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("applies the primary variant class by default", () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole("button")).toHaveClass("az-btn-primary");
  });

  it("applies a chosen variant and merges custom classes", () => {
    render(
      <Button variant="danger" className="w-full">
        Delete
      </Button>
    );
    const btn = screen.getByRole("button");
    expect(btn).toHaveClass("az-btn-danger");
    expect(btn).toHaveClass("w-full");
  });

  it("fires onClick when clicked", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("respects the disabled attribute", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Nope
      </Button>
    );
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
    await userEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });
});
