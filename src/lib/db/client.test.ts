import { describe, expect, it } from "vitest";
import { getPgSslConfig } from "@/lib/db/client";

describe("getPgSslConfig", () => {
  it("disables SSL for loopback database URLs", () => {
    expect(
      getPgSslConfig("postgresql://postgres:postgres@localhost:54322/postgres"),
    ).toBe(false);
    expect(
      getPgSslConfig("postgresql://postgres:postgres@127.0.0.1:54322/postgres"),
    ).toBe(false);
    expect(getPgSslConfig("postgresql://postgres:postgres@[::1]:54322/postgres")).toBe(
      false,
    );
  });

  it("honors explicit sslmode settings", () => {
    expect(
      getPgSslConfig(
        "postgresql://postgres:postgres@db.example.com/postgres?sslmode=disable",
      ),
    ).toBe(false);
    expect(
      getPgSslConfig(
        "postgresql://postgres:postgres@127.0.0.1:54322/postgres?sslmode=require",
      ),
    ).toEqual({ rejectUnauthorized: false });
  });

  it("uses SSL for hosted database URLs by default", () => {
    expect(
      getPgSslConfig("postgresql://postgres:postgres@db.example.com/postgres"),
    ).toEqual({
      rejectUnauthorized: false,
    });
  });
});
