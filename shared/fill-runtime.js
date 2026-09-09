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
      const hasStrongPickerDateKeyword =
        /(出生日期|出生年月|开始时间|开始日期|结束时间|结束日期|入学时间|毕业时间|获奖时间|获奖日期|发表时间|发布日期|publicationdate|startdate|enddate|birthdate|awarddate)/.test(text);

      return Boolean(runtime?.kind === "custom_picker" && hasStrongPickerDateKeyword) ||
        Boolean(runtime?.hasCalendarIcon && hasDateKeyword) ||
        Boolean(runtime?.readOnly && hasDateKeyword);
    }

    function inferRuntimeDatePrecision(runtime) {
      if (["year", "month", "day"].includes(runtime?.pickerPrecision)) {
        return runtime.pickerPrecision;
      }
      if (runtime?.inputType === "month") return "month";
      if (["date", "datetime-local"].includes(runtime?.inputType)) return "day";

      const text = collectRuntimeText(runtime);
      if (
        /(年份|年度|选择年份|请选择年份|请输入年份|入学年份|毕业年份|获奖年份|发表年份|year picker|yearpicker|picker year|yyyy格式)/.test(text)
      ) {
        return "year";
      }
      if (
        /(年月|月份|选择月份|选择年月|请选择月份|请选择年月|入学年月|毕业年月|获奖年月|发表年月|month picker|monthpicker|picker month|yyyy[-/.]mm|yyyy年mm月)/.test(text)
      ) {
        return "month";
      }
      return "";
    }

    function inferRuntimeDateComponent(runtime) {
      if (["year", "month", "day"].includes(runtime?.dateComponent)) {
        return runtime.dateComponent;
      }

      const role = String(runtime?.compositeRole || "").toLowerCase();
      if (["year", "month", "day"].includes(role)) return role;

      const placeholder = normalizeText(runtime?.placeholder || "");
      if (/^(请选择|请填写|选择)?年(份|度)?$/.test(placeholder) || placeholder === "年") {
        return "year";
      }
      if (/^(请选择|请填写|选择)?月(份)?$/.test(placeholder) || placeholder === "月") {
        return "month";
      }
      if (/^(请选择|请填写|选择)?(日|号)$/.test(placeholder)) {
        return "day";
      }

      if (runtime?.kind === "select") {
        const options = Array.from(runtime?.el?.options || [])
          .map((option) => normalizeText(option?.textContent || option?.value || ""))
          .filter(Boolean);
        const yearCount = options.filter((option) => /^(?:19|20)\d{2}年?$/.test(option)).length;
        const monthCount = options.filter((option) => /^(?:0?[1-9]|1[0-2])月?$/.test(option)).length;
        const dayCount = options.filter((option) => /^(?:0?[1-9]|[12]\d|3[01])日?$/.test(option)).length;
        if (yearCount >= 3) return "year";
        if (monthCount >= 6 && dayCount < 20) return "month";
        if (dayCount >= 20) return "day";
      }

      const text = collectRuntimeText(runtime);
      if (/(年份|年度|入学年|毕业年|获奖年|发表年|year only|yearonly)/.test(text)) {
        return "year";
      }
      if (
        !runtime?.hasCalendarIcon &&
        runtime?.kind !== "custom_picker" &&
        !/年月/.test(text) &&
        /(月份|month only|monthonly)/.test(text)
      ) {
        return "month";
      }
      return "";
    }

    function normalizeValueForRuntime(runtime, rawValue) {
      const text = String(rawValue ?? "").trim();
      if (!text) return "";

      const explicitPart = ["year", "month", "day"].includes(runtime?.dateComponent)
        ? runtime.dateComponent
        : String(runtime?.compositeRole || "").toLowerCase();
      if (["year", "month", "day"].includes(explicitPart)) {
        return text;
      }

      if (!isDateLikeRuntime(runtime)) {
        return text;
      }

      const precision = inferRuntimeDatePrecision(runtime);
      if (precision === "year") {
        const parsed = parseComparableDate(text);
        return parsed.year ? String(parsed.year).padStart(4, "0") : text;
      }

      if (precision === "month") {
        if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text.slice(0, 7);
        if (/^\d{4}-\d{2}$/.test(text)) return text;
        return "";
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

    function expandDateOptionCandidates(value) {
      const text = String(value ?? "").trim();
      if (!text) return [];

      const parts = parseDateParts(text);
      if (!parts.year) return [text];

      const year = String(parts.year);
      if (!parts.month) {
        return Array.from(new Set([text, year, `${year}年`]));
      }

      const month = String(parts.month);
      const mm = month.padStart(2, "0");
      const variants = [
        text,
        `${year}-${mm}`,
        `${year}/${mm}`,
        `${year}.${mm}`,
        `${year}年${mm}月`,
        `${year}年${month}月`,
      ];
      if (parts.day) {
        const day = String(parts.day);
        const dd = day.padStart(2, "0");
        variants.push(
          `${year}-${mm}-${dd}`,
          `${year}年${mm}月${dd}日`,
          `${year}年${month}月${day}日`
        );
      }
      return Array.from(new Set(variants));
    }

    function parseDateParts(value) {
      const text = String(value || "").trim();
      const match = text.match(
        /^(\d{4})(?:[-/.年]\s*(\d{1,2}))?(?:(?:[-/.月]\s*(\d{1,2})\s*日?)|月)?$/
      );
      if (!match) {
        return { year: 0, month: 0, day: 0 };
      }

      return {
        year: Number(match[1] || 0),
        month: Number(match[2] || 0),
        day: Number(match[3] || 0),
      };
    }

    function parseComparableDate(value) {
      const parts = parseDateParts(value);
      if (parts.year) return parts;

      const usMatch = String(value || "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      return usMatch
        ? {
            year: Number(usMatch[3] || 0),
            month: Number(usMatch[1] || 0),
            day: Number(usMatch[2] || 0),
          }
        : { year: 0, month: 0, day: 0 };
    }

    function normalizeDatePanelToken(value) {
      return String(value || "").toLowerCase().replace(/\s+/g, "").trim();
    }

    function parsePickerMonthToken(value) {
      const token = normalizeDatePanelToken(value).replace(/[.,]/g, "");
      const numeric = token.match(/^(1[0-2]|0?[1-9])月?$/);
      if (numeric) return Number(numeric[1]);

      const monthNames = [
        ["jan", "january"], ["feb", "february"], ["mar", "march"],
        ["apr", "april"], ["may"], ["jun", "june"],
        ["jul", "july"], ["aug", "august"], ["sep", "sept", "september"],
        ["oct", "october"], ["nov", "november"], ["dec", "december"],
      ];
      const index = monthNames.findIndex((aliases) => aliases.includes(token));
      return index >= 0 ? index + 1 : 0;
    }

    function getPickerMonthLabels(month) {
      const fullNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
      ];
      const fullName = fullNames[Number(month) - 1] || "";
      return [
        `${Number(month)}月`,
        String(Number(month)),
        String(Number(month)).padStart(2, "0"),
        fullName,
        fullName.slice(0, 3),
      ].filter(Boolean);
    }

    return {
      isDateLikeRuntime,
      isReadonlyDateLikeRuntime,
      inferRuntimeDateComponent,
      inferRuntimeDatePrecision,
      normalizeValueForRuntime,
      matchesWrittenValue,
      parseDateParts,
      expandDateOptionCandidates,
      parseComparableDate,
      normalizeDatePanelToken,
      parsePickerMonthToken,
      getPickerMonthLabels,
    };
  }
);
