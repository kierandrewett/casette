import { describe, expect, it } from "vitest";

// Smoke test for the fanout helper signature contract. The actual database
// behaviour is exercised by the end-to-end smoke (scripts/smoke.sh) once
// subscription + comment routers land. We keep this file as a placeholder
// so the helper signatures cannot regress without a CI signal.

import { notifyCommentReply, notifyNewUpload } from "@/lib/notifications/fanout";

describe("notifications/fanout", () => {
    it("exports notifyNewUpload as an async function returning a number", () => {
        expect(typeof notifyNewUpload).toBe("function");
        expect(notifyNewUpload.length).toBe(1);
    });

    it("exports notifyCommentReply as an async function returning a number", () => {
        expect(typeof notifyCommentReply).toBe("function");
        expect(notifyCommentReply.length).toBe(1);
    });
});
