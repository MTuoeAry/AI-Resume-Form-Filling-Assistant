(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.ResumeFillRuntime = api;
})(
  typeof globalThis !== "undefined" ? globalThis : this,
  function () {
    "use strict";

    function normalizeText(value) {
      return String(value || "")
        .trim()
        .toLowerCase();
    }

    function collectRuntimeText(runtime) {
      const parts = [
        runtime?.label,
        runtime?.baseLabel,
        runtime?.placeholder,
        runtime?.id,
        runtime?.name,
        runtime?.context,
        ...(Array.isArray(runtime?.nearbyLabels) ? runtime.nearbyLabels : []),
      ];

      return parts.map((item) => normalizeText(item)).filter(Boolean).join(" ");
    }

    function isReadonlyDateLikeRuntime(runtime) {
      return Boolean(runtime?.readOnly && isDateLikeRuntime(runtime));
    }

    function isDateLikeRuntime(runtime) {
      if (!runtime) return false;
      if (["date", "month", "datetime-local"].includes(runtime.inputType)) {
        return true;
      }
      if (runtime.inputType && runtime.inputType !== "text") return false;

      const text = collectRuntimeText(runtime);
      if (!text) return Boolean(runtime?.hasCalendarIcon);

      const hasDateKeyword =
        /(入学|毕业|在校|开始|结束|获奖|发表|发布|出生|任职|就职|时间|日期|年月|date|time|month|calendar|published|awarded)/.test(text);

      return Boolean(runtime?.hasCalendarIcon && hasDateKeyword) ||
        Boolean(runtime?.readOnly && hasDateKeyword);
    }

    function prefersMonthPrecision(runtime) {
      if (runtime?.inputType === "month" || runtime?.pickerPrecision === "month") {
        return true;
      }
      if (
        ["date", "datetime-local"].includes(runtime?.inputType) ||
        runtime?.pickerPrecision === "day"
      ) {
        return false;
      }
      const text = collectRuntimeText(runtime);
      return /(年月|月份|选择月份|选择年月|month picker|monthpicker|picker month)/.test(text);
    }

    function normalizeValueForRuntime(runtime, rawValue) {
      const text = String(rawValue ?? "").trim();
      if (!text) return "";

      if (!isDateLikeRuntime(runtime)) {
        return text;
      }

      if (prefersMonthPrecision(runtime)) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text.slice(0, 7);
        if (/^\d{4}-\d{2}$/.test(text)) return text;
        if (/^\d{4}$/.test(text)) return `${text}-01`;
      }

      return text;
    }

    function matchesWrittenValue(runtime, actualValue, desiredValue) {
      const actual = String(actualValue ?? "").trim();
      const desired = String(desiredValue ?? "").trim();
      if (!actual || !desired) return false;

      if (isDateLikeRuntime(runtime)) {
        if (actual === desired) return true;
        const actualParts = parseComparableDate(actual);
        const desiredParts = parseComparableDate(desired);
        if (actualParts.year && desiredParts.year && actualParts.year === desiredParts.year) {
          if (!desiredParts.month) return true;
          if (actualParts.month !== desiredParts.month) return false;
          if (!desiredParts.day) return true;
          return actualParts.day === desiredParts.day;
        }
      }

      return actual === desired;
    }

    function parseComparableDate(value) {
      const text = String(value || "").trim();
      const match = text.match(
        /^(\d{4})(?:[-/.年]\s*(\d{1,2}))?(?:(?:[-/.月]\s*(\d{1,2})\s*日?)|月)?$/
      );
      if (match) {
        return {
          year: Number(match[1] || 0),
          month: Number(match[2] || 0),
          day: Number(match[3] || 0),
        };
      }

      const usMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      return usMatch
        ? {
            year: Number(usMatch[3] || 0),
            month: Number(usMatch[1] || 0),
            day: Number(usMatch[2] || 0),
          }
        : { year: 0, month: 0, day: 0 };
    }

    return {
      isDateLikeRuntime,
      isReadonlyDateLikeRuntime,
      normalizeValueForRuntime,
      matchesWrittenValue,
    };
  }
);
