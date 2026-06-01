import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";

export type AppLanguage = "en" | "zh";

type I18nContextValue = {
  language: AppLanguage;
  setLanguage: (next: AppLanguage) => void;
  toggleLanguage: () => void;
  t: (key: string, fallback?: string) => string;
};

const LANGUAGE_STORAGE_KEY = "somaticbuilding.language";
const TRANSLATABLE_ATTRIBUTE_NAMES = ["placeholder", "title", "aria-label"];

const keyDictionary: Record<AppLanguage, Record<string, string>> = {
  en: {
    "lang.label": "Language",
    "lang.switch": "中文",
    "nav.home": "Home",
    "nav.train": "Train",
    "nav.library": "Library",
    "nav.posture": "Posture",
    "nav.profile": "Profile",
    "assistant.title": "AI Coach",
    "assistant.subtitle": "Real-time Guidance",
    "assistant.connecting": "Connecting assistant...",
    "assistant.thinking": "Assistant is thinking...",
    "assistant.placeholder": "Ask about movement, training, or recovery...",
    "assistant.send": "Send message",
    "assistant.close": "Close assistant chat",
    "assistant.unavailable":
      "The AI service is temporarily unavailable. Please try again shortly.",
    "assistant.welcome":
      "I am your Somatic AI assistant. Ask about movement form, training plans, or recovery.",
    "account.user": "USER",
    "account.login": "Login",
    "account.title": "Account",
    "account.loginRegister": "Login / Register",
    "account.startSystemFlow": "Start System Flow",
    "account.openLogin": "Open Login Page",
    "account.profile": "Profile",
    "account.signOut": "Sign Out"
  },
  zh: {
    "lang.label": "语言",
    "lang.switch": "EN",
    "nav.home": "首页",
    "nav.train": "训练",
    "nav.library": "动作库",
    "nav.posture": "体态",
    "nav.profile": "档案",
    "assistant.title": "AI 教练",
    "assistant.subtitle": "实时指导",
    "assistant.connecting": "正在连接助手...",
    "assistant.thinking": "助手正在思考...",
    "assistant.placeholder": "可提问动作、训练计划或恢复建议...",
    "assistant.send": "发送消息",
    "assistant.close": "关闭助手对话",
    "assistant.unavailable": "AI 服务暂时不可用，请稍后重试。",
    "assistant.welcome": "我是你的 Somatic AI 助手，可询问动作技术、训练安排与恢复建议。",
    "account.user": "用户",
    "account.login": "登录",
    "account.title": "账号",
    "account.loginRegister": "登录 / 注册",
    "account.startSystemFlow": "开始系统流程",
    "account.openLogin": "打开登录页",
    "account.profile": "个人档案",
    "account.signOut": "退出登录"
  }
};

const phrasePairsEnToZh: Array<[string, string]> = [
  ["Home", "首页"],
  ["Train", "训练"],
  ["Library", "动作库"],
  ["Posture", "体态"],
  ["Profile", "档案"],
  ["Login / Register", "登录 / 注册"],
  ["Login", "登录"],
  ["Register", "注册"],
  ["Account", "账号"],
  ["Sign Out", "退出登录"],
  ["Start System Flow", "开始系统流程"],
  ["Open Login Page", "打开登录页"],
  ["AI Coach", "AI 教练"],
  ["Real-time Guidance", "实时指导"],
  ["Connecting assistant...", "正在连接助手..."],
  ["Assistant is thinking...", "助手正在思考..."],
  ["The AI service is temporarily unavailable. Please try again shortly.", "AI 服务暂时不可用，请稍后重试。"],
  ["Ask about movement, training, or recovery...", "可提问动作、训练计划或恢复建议..."],
  ["Send message", "发送消息"],
  ["Close assistant chat", "关闭助手对话"],
  ["System Selection", "系统选择"],
  ["All Systems", "全部系统"],
  ["All Exercises", "全部动作"],
  ["Exercise Library", "动作库"],
  ["Filters", "筛选"],
  ["Style", "风格"],
  ["Category", "分类"],
  ["Ability", "能力"],
  ["Equipment", "器械"],
  ["Difficulty", "难度"],
  ["Data source", "数据来源"],
  ["Backend API", "后端接口"],
  ["Local fallback", "本地兜底"],
  ["Loading...", "加载中..."],
  ["Add Custom Exercise", "新增自定义动作"],
  ["Create Custom Exercise", "创建自定义动作"],
  ["Exercise Name", "动作名称"],
  ["Primary Muscle", "主要肌群"],
  ["Cover URL", "封面链接"],
  ["Video URL (optional)", "视频链接（可选）"],
  ["Description", "描述"],
  ["Cancel", "取消"],
  ["Create Exercise", "创建动作"],
  ["View Details", "查看详情"],
  ["Training Cart", "训练车"],
  ["selected", "已选"],
  ["Queue", "队列"],
  ["Start Training", "开始训练"],
  ["Save as Template", "保存为模板"],
  ["Template name", "模板名称"],
  ["Clear cart", "清空训练车"],
  ["Selected", "已选"],
  ["movements", "动作"],
  ["Review Cart", "查看训练车"],
  ["Prev", "上一页"],
  ["Next", "下一页"],
  ["Page", "页"],
  ["Total", "总计"],
  ["No image", "暂无图片"],
  ["Add", "添加"],
  ["Added", "已添加"],
  ["Close", "关闭"],
  ["System", "系统"],
  ["Goal", "目标"],
  ["Goals", "目标"],
  ["Assessment", "评估"],
  ["Summary", "总结"],
  ["History", "历史"],
  ["Continue", "继续"],
  ["Back", "返回"],
  ["Start", "开始"],
  ["Finish", "完成"],
  ["Workout", "训练"],
  ["Template", "模板"],
  ["Module", "模块"],
  ["Program", "计划"],
  ["Quick", "快速"],
  ["Start_Session", "开始训练"],
  ["Workout Builder", "训练编排"],
  ["Workout Player", "训练执行"],
  ["Program Planner", "计划编排"],
  ["Quick Module", "快速模块"],
  ["Template Library", "模板库"],
  ["Assessment Intro", "评估介绍"],
  ["Active Assessment", "进行中评估"],
  ["Assessment List", "评估列表"],
  ["System Entry", "系统入口"],
  ["Onboarding", "引导"],
  ["History", "历史"],
  ["Summary", "总结"],
  ["Save", "保存"],
  ["Delete", "删除"],
  ["Edit", "编辑"],
  ["Apply", "应用"],
  ["Create", "创建"],
  ["Custom", "自定义"],
  ["Session", "课程"],
  ["Training", "训练"],
  ["Muscle", "肌群"],
  ["Movement", "动作"],
  ["Details", "详情"],
  ["Continue", "继续"]
];

const phrasePairs = [...phrasePairsEnToZh].sort((a, b) => b[0].length - a[0].length);

const textOriginalMap = new WeakMap<Text, string>();
const attrOriginalMap = new WeakMap<Element, Record<string, string>>();

const I18nContext = createContext<I18nContextValue | null>(null);

const translateEnglishToChinese = (source: string) => {
  let output = source;
  for (const [from, to] of phrasePairs) {
    if (output.includes(from)) {
      output = output.split(from).join(to);
    }
  }
  return output;
};

const shouldSkipTextNode = (node: Text) => {
  const parent = node.parentElement;
  if (!parent) return true;

  if (parent.isContentEditable) return true;

  const tag = parent.tagName;
  if (
    tag === "SCRIPT" ||
    tag === "STYLE" ||
    tag === "NOSCRIPT" ||
    tag === "CODE" ||
    tag === "PRE" ||
    tag === "TEXTAREA" ||
    tag === "INPUT" ||
    tag === "OPTION"
  ) {
    return true;
  }

  return false;
};

const resolveOriginalText = (node: Text, language: AppLanguage) => {
  const current = node.nodeValue ?? "";
  const cached = textOriginalMap.get(node);

  if (language === "en") {
    textOriginalMap.set(node, current);
    return current;
  }

  if (!cached) {
    textOriginalMap.set(node, current);
    return current;
  }

  const translatedCached = translateEnglishToChinese(cached);
  if (current !== translatedCached) {
    textOriginalMap.set(node, current);
    return current;
  }

  return cached;
};

const resolveOriginalAttribute = (
  element: Element,
  attributeName: string,
  language: AppLanguage
) => {
  const current = element.getAttribute(attributeName);
  if (current === null) return null;

  const cache = attrOriginalMap.get(element) ?? {};
  const cached = cache[attributeName];

  if (language === "en") {
    cache[attributeName] = current;
    attrOriginalMap.set(element, cache);
    return current;
  }

  if (!cached) {
    cache[attributeName] = current;
    attrOriginalMap.set(element, cache);
    return current;
  }

  const translatedCached = translateEnglishToChinese(cached);
  if (current !== translatedCached) {
    cache[attributeName] = current;
    attrOriginalMap.set(element, cache);
    return current;
  }

  return cached;
};

const applyDomLanguage = (root: ParentNode, language: AppLanguage) => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];

  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (!node.nodeValue || !node.nodeValue.trim()) continue;
    if (shouldSkipTextNode(node)) continue;
    textNodes.push(node);
  }

  for (const node of textNodes) {
    const source = resolveOriginalText(node, language);
    const next = language === "zh" ? translateEnglishToChinese(source) : source;
    if (node.nodeValue !== next) {
      node.nodeValue = next;
    }
  }

  for (const attributeName of TRANSLATABLE_ATTRIBUTE_NAMES) {
    const elements = root.querySelectorAll(`[${attributeName}]`);
    elements.forEach((element) => {
      const source = resolveOriginalAttribute(element, attributeName, language);
      if (source === null) return;

      const next = language === "zh" ? translateEnglishToChinese(source) : source;
      if (element.getAttribute(attributeName) !== next) {
        element.setAttribute(attributeName, next);
      }
    });
  }
};

const readInitialLanguage = (): AppLanguage => {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (stored === "en" || stored === "zh") return stored;

  const browser = window.navigator.language.toLowerCase();
  if (browser.startsWith("zh")) return "zh";
  return "en";
};

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(() => readInitialLanguage());

  const setLanguage = useCallback((next: AppLanguage) => {
    setLanguageState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
    }
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage(language === "en" ? "zh" : "en");
  }, [language, setLanguage]);

  const t = useCallback(
    (key: string, fallback?: string) => {
      const dictionary = keyDictionary[language];
      return dictionary[key] ?? fallback ?? key;
    },
    [language]
  );

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  }, [language]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!document.body) return;

    let applying = false;

    const runApply = () => {
      if (!document.body) return;
      applying = true;
      try {
        applyDomLanguage(document.body, language);
      } finally {
        applying = false;
      }
    };

    runApply();

    const observer = new MutationObserver(() => {
      if (applying) return;
      runApply();
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: TRANSLATABLE_ATTRIBUTE_NAMES
    });

    return () => {
      observer.disconnect();
    };
  }, [language]);

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      setLanguage,
      toggleLanguage,
      t
    }),
    [language, setLanguage, toggleLanguage, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider.");
  }
  return context;
};
