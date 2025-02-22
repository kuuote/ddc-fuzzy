import * as Matcher from "./denops/@ddc-filters/matcher_fuzzy.ts";
import * as Sorter from "./denops/@ddc-filters/sorter_fuzzy.ts";
import * as Converter from "./denops/@ddc-filters/converter_fuzzy.ts";
import { assertEquals } from "https://deno.land/std@0.164.0/testing/asserts.ts";
import {
  assertSpyCallArg,
  stub,
} from "https://deno.land/std@0.164.0/testing/mock.ts";
import type { PumHighlight } from "https://deno.land/x/ddc_vim@v3.1.0/types.ts";

const matcher = new Matcher.Filter();
const sorter = new Sorter.Filter();
const converter = new Converter.Filter();

Deno.test("matcher", async () => {
  assertEquals(
    await matcher.filter({
      sourceOptions: { ignoreCase: false },
      completeStr: "abc",
      items: [{ word: "0a0b0c0" }, { word: "axbc" }, { word: "abc" }, {
        word: "xyz",
      }],
      filterParams: { splitMode: "character" },
    } as any),
    [{ word: "0a0b0c0" }, { word: "axbc" }, { word: "abc" }],
  );
  assertEquals(
    await matcher.filter({
      sourceOptions: { ignoreCase: false },
      completeStr: "aBc",
      items: [{ word: "0a0B0c0" }, { word: "axBc" }, { word: "aBxc" }, {
        word: "aBc",
      }, { word: "xyz" }],
      filterParams: { splitMode: "word" },
    } as any),
    [{ word: "0a0B0c0" }, { word: "axBc" }, { word: "aBc" }],
  );
});

Deno.test("sorter", async () => {
  assertEquals(
    await sorter.filter({
      sourceOptions: { ignoreCase: false },
      completeStr: "abc",
      items: [{ word: "0a0b0c0" }, { word: "abc" }],
    } as any),
    [{ word: "abc" }, { word: "0a0b0c0" }],
  );
});

function highlight(col: number): PumHighlight {
  return {
    type: "abbr",
    name: "ddc_fuzzy_matched_character",
    col,
    width: 1,
    "hl_group": "SpellBad",
  };
}

Deno.test("converter", async () => {
  const bulk_strlen_stub = stub(
    Converter._internals,
    "bulk_strlen",
    (_, slist: string[]) => Promise.resolve(slist.map((s) => s.length)),
  );
  try {
    assertEquals(
      await converter.filter({
        sourceOptions: { ignoreCase: false },
        completeStr: "abc",
        items: [{ word: "0a0b0c0" }, { word: "abc" }, { word: "xyz" }],
        filterParams: { hlGroup: "SpellBad" },
      } as any),
      [
        {
          word: "0a0b0c0",
          highlights: [highlight(1), highlight(3), highlight(5)],
        },
        { word: "abc", highlights: [highlight(0), highlight(1), highlight(2)] },
        { word: "xyz" },
      ],
    );
  } finally {
    bulk_strlen_stub.restore();
  }
});

Deno.test("converter:multibytes-items", async () => {
  const bulk_strlen_stub = stub(
    Converter._internals,
    "bulk_strlen",
    () => Promise.resolve([0, 4, 4, 3, 5, 1]),
  );
  try {
    assertEquals(
      await converter.filter({
        sourceOptions: { ignoreCase: false },
        completeStr: "abc",
        items: [
          { word: "aＡbＢcＣd" },
          { word: "xyz" },
          { word: "\u6F22a\uD83C\uDC04bc" },
        ],
        filterParams: { hlGroup: "SpellBad" },
      } as any),
      [
        {
          word: "aＡbＢcＣd",
          highlights: [highlight(0), highlight(4), highlight(8)],
        },
        { word: "xyz" },
        {
          word: "\u6F22a\uD83C\uDC04bc",
          highlights: [highlight(3), highlight(8), highlight(9)],
        },
      ],
    );
    assertSpyCallArg(bulk_strlen_stub, 0, 1, [
      "",
      "aＡ",
      "bＢ",
      "\u6F22",
      "a\uD83C\uDC04",
      "b",
    ]);
  } finally {
    bulk_strlen_stub.restore();
  }
});

Deno.test("converter:multibytes-completeStr", async () => {
  const bulk_strlen_stub = stub(
    Converter._internals,
    "bulk_strlen",
    () => Promise.resolve([3, 3, 6]),
  );
  try {
    assertEquals(
      await converter.filter({
        sourceOptions: { ignoreCase: false },
        completeStr: "ＡＢＣ",
        items: [{ word: "fooＡＢbarＣbaz" }],
        filterParams: { hlGroup: "SpellBad" },
      } as any),
      [{
        word: "fooＡＢbarＣbaz",
        highlights: [highlight(3), highlight(6), highlight(12)],
      }],
    );
    assertSpyCallArg(bulk_strlen_stub, 0, 1, ["foo", "Ａ", "Ｂbar"]);
  } finally {
    bulk_strlen_stub.restore();
  }
});
