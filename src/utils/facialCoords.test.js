import {
  DEFAULT_FACIAL_COORDS,
  FACIAL_ALIGN_STORAGE_KEY,
  buildFacialCss,
  clearFacialCoords,
  facialCoordsToStyle,
  loadFacialCoords,
  normalizeFacialCoords,
  saveFacialCoords,
} from "./facialCoords";

describe("facialCoords", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("fills missing values from defaults", () => {
    expect(normalizeFacialCoords({ mouthTop: 70 })).toEqual({
      ...DEFAULT_FACIAL_COORDS,
      mouthTop: 70,
    });
  });

  test("loads defaults when nothing is saved", () => {
    expect(loadFacialCoords()).toEqual(DEFAULT_FACIAL_COORDS);
  });

  test("saves and loads mouth position and size", () => {
    saveFacialCoords({
      ...DEFAULT_FACIAL_COORDS,
      mouthLeft: 48.2,
      mouthTop: 61.5,
      mouthWidth: 16,
      mouthHeight: 8,
    });

    expect(loadFacialCoords()).toMatchObject({
      mouthLeft: 48.2,
      mouthTop: 61.5,
      mouthWidth: 16,
      mouthHeight: 8,
    });
    expect(localStorage.getItem(FACIAL_ALIGN_STORAGE_KEY)).toContain("16");
  });

  test("maps coords to CSS variables for the live avatar", () => {
    expect(
      facialCoordsToStyle({
        mouthLeft: 47,
        mouthTop: 62,
        mouthWidth: 14,
        mouthHeight: 7,
      })
    ).toMatchObject({
      "--scotty-mouth-left": "47%",
      "--scotty-mouth-top": "62%",
      "--scotty-mouth-width": "14%",
      "--scotty-mouth-height": "7%",
    });
  });

  test("builds CSS that the avatar can lock in", () => {
    const css = buildFacialCss({ mouthWidth: 18, mouthHeight: 9 });
    expect(css).toContain("--scotty-mouth-width: 18%");
    expect(css).toContain("--scotty-mouth-height: 9%");
  });

  test("reset clears saved coords", () => {
    saveFacialCoords({ mouthWidth: 20 });
    expect(clearFacialCoords()).toEqual(DEFAULT_FACIAL_COORDS);
    expect(localStorage.getItem(FACIAL_ALIGN_STORAGE_KEY)).toBeNull();
  });
});
