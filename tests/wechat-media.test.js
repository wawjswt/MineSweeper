import test from "node:test";
import assert from "node:assert/strict";
import { createWechatMedia } from "../src/platform/wechat/media.js";

test("Wechat media normalizes a selected image", async () => {
  const media = createWechatMedia({
    chooseImage: ({ success }) => success({ tempFilePaths: ["wxfile://image"], tempFiles: [{ width: 120, height: 80 }] }),
  });
  assert.deepEqual(await media.chooseImage(), { path: "wxfile://image", width: 120, height: 80 });
});

test("Wechat media failures are best effort and return null", async () => {
  const media = createWechatMedia({
    chooseImage: ({ fail }) => fail(new Error("cancelled")),
  });
  assert.equal(await media.chooseImage(), null);
  assert.equal(await createWechatMedia({}).chooseImage(), null);
});
