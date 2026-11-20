import { expect, test } from "bun:test";
import { syllabus, syllabusProblems } from "./syllabus";

test("the syllabus has a module per part, a unit per step and stable keys", () => {
  const tree = syllabus();
  expect(tree.modules.length).toBeGreaterThan(1);
  expect(tree.modules[0].units[0].items[0].kind).toBe("lab");
  expect(syllabusProblems(tree)).toEqual([]);
});

test("a key that is not stable, or is used twice, is a problem", () => {
  const unit = (key: string) => ({ key, title: "T", items: [] });
  expect(
    syllabusProblems({ modules: [{ key: "a", title: "A", units: [unit("Bad Key")] }] }).length,
  ).toBe(1);
  expect(
    syllabusProblems({ modules: [{ key: "a", title: "A", units: [unit("x"), unit("x")] }] }).length,
  ).toBe(1);
});
