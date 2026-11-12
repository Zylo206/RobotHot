// 这个行业的分类体系：类别、标签词表、公司（主体）名录，以及防止张冠李戴的身份词典。
// 模型按这里的词表打标签，主题页（topics.json）按标签归类，筛选栏按类别分组。
// 换行业时：类别的 key 会出现在网址里（/all?category=…），上线后就不要再改；标签和名录可以随时增减。

/**
 * 网页上的类别（筛选栏、卡片角标、RSS 分类订阅）。key 是网址和接口里的身份，上线后不要改。
 * section 是日报里的分节标题（几个类别可以共用一节，按这里的顺序排）；guide 告诉模型怎么归类。
 * 没归上类的资料在日报里放进第一个 key 为 industry 的类别所在的节（没有就放最后一节）。
 */
export const CATEGORIES = [
  { key: "models", label: "模型与算法", section: "模型与算法", guide: "VLA、世界模型、具身基础模型、仿真平台与训练框架的发布、迭代与评测结果" },
  { key: "products", label: "机器人与产品", section: "产品发布/更新", guide: "人形机器人与各类机器人的整机发布、功能更新、量产交付与核心零部件进展" },
  { key: "industry", label: "行业", section: "行业动态", guide: "公司经营、融资并购、人事、合作、诉讼、市场与供应链、监管与政策" },
  { key: "research", label: "论文", section: "论文研究", guide: "研究论文、技术报告、基准与数据集" },
  { key: "tutorial", label: "教程", section: "观点与实践", guide: "开发教程、部署实践、仿真与数据集使用、工具用法、深度技术讲解" },
  { key: "opinion", label: "观点", section: "观点与实践", guide: "人物观点、评论、分析、访谈、现象与趋势讨论" },
] as const;

/**
 * 内容理解一步给每篇资料判的“内容类型”（写在 prompts/content-understanding.md 里，改了类型要同步改那份提示词）。
 * 评分提示词（prompts/selection-score.md）按类型给五个维度不同的权重。
 */
export const ITEM_TYPES = ["model_release", "product_launch", "tool_or_prompt", "research_paper", "industry_event", "opinion_analysis", "tutorial_explainer"] as const;

// ── 标签词表 ────────────────────────────────────────────────────────────────────────────

/** 每篇资料的第一个标签必须是这些“分类标签”之一。 */
export const CATEGORY_TAGS = [
  "产品发布", "模型发布", "论文/研究", "开源/仓库", "教程/实践", "现象/趋势", "大佬观点", "评测/基准", "安全/治理", "行业动态", "政策/监管",
  "非机器人/通用", "其他",
] as const;

/** 可选的主题标签。 */
export const TOPIC_TAGS = [
  "人形机器人", "具身智能", "VLA", "世界模型", "仿真/合成数据", "数据/训练", "运动控制", "灵巧操作", "Sim2Real", "物理 AI", "零部件", "量产/交付", "端侧", "部署/工程", "开源生态", "多模态", "语音交互", "视觉导航", "安全/治理",
] as const;

/** 可选的实体标签（公司、机构、平台）。 */
export const ENTITY_TAGS = ["科沃斯", "宇树", "智元", "优必选", "Figure", "特斯拉", "波士顿动力", "NVIDIA", "Google", "DeepSeek"] as const;

/** 模型常写的近义词，统一成词表里的写法。 */
export const TAG_SYNONYMS: Readonly<Record<string, string>> = {
  "教程/玩法": "教程/实践", "技巧/最佳实践": "教程/实践", "合作/生态": "行业动态", "融资/收购": "行业动态", "公司动态": "行业动态",
  合作: "行业动态", 生态: "行业动态", 融资: "行业动态", 收购: "行业动态", 投资: "行业动态", 并购: "行业动态", 上市: "行业动态",
  政策: "政策/监管", 监管: "政策/监管", 法规: "政策/监管", 标准: "政策/监管",
  论文: "论文/研究", 研究: "论文/研究", paper: "论文/研究", papers: "论文/研究",
  "open-source": "开源/仓库", 开源: "开源/仓库", 仓库: "开源/仓库", repo: "开源/仓库", 权重开放: "开源/仓库",
  教程: "教程/实践", 玩法: "教程/实践", 指南: "教程/实践", 技巧: "教程/实践", 最佳实践: "教程/实践", 实践: "教程/实践", 部署: "部署/工程",
  产品: "产品发布", 发布: "产品发布", 上新: "产品发布", 量产: "量产/交付", 交付: "量产/交付", 出货: "量产/交付",
  模型: "模型发布", 趋势: "现象/趋势", 现象: "现象/趋势", 观点: "大佬观点", 访谈: "大佬观点",
  人形: "人形机器人", 四足: "人形机器人", 机器狗: "人形机器人", 灵巧手: "零部件", 关节: "零部件", 减速器: "零部件", 丝杠: "零部件", 传感器: "零部件",
  具身: "具身智能", 世界动作模型: "世界模型", 仿真: "仿真/合成数据", 合成数据: "仿真/合成数据", 遥操作: "数据/训练", 数据: "数据/训练", 训练: "数据/训练",
  端侧: "端侧", 安全: "安全/治理", 治理: "安全/治理", 行业: "行业动态", 动态: "行业动态",
  // 英文关键词统一到上面的中文词表（见 industry/prompts/prefilter.md 的重点关键词监控）。
  vla: "VLA", "vision-language-action": "VLA", "embodied ai": "具身智能", embodied: "具身智能",
  humanoid: "人形机器人", "world model": "世界模型", "world models": "世界模型",
  "dexterous manipulation": "灵巧操作", "dexterous hand": "零部件", manipulation: "灵巧操作",
  "sim2real": "Sim2Real", "sim-to-real": "Sim2Real", "sim to real": "Sim2Real",
  "physical ai": "物理 AI", "physical-ai": "物理 AI", 物理ai: "物理 AI",
};

/** 模型漏了分类标签时，按内容类型补一个。 */
export const CATEGORY_BY_ITEM_TYPE: Readonly<Record<string, string>> = {
  model_release: "模型发布", product_launch: "产品发布", tool_or_prompt: "教程/实践", research_paper: "论文/研究",
  industry_event: "行业动态", opinion_analysis: "大佬观点", tutorial_explainer: "教程/实践",
};

// ── 公司与主体 ──────────────────────────────────────────────────────────────────────────

/** 公司主题：id → 显示名、卡片上显示的标签（null 表示只用 entity:<id> 归类）、别名。 */
export const ENTITIES: Record<string, { name: string; displayTag: string | null; aliases: string[] }> = {
  ecovacs: { name: "科沃斯", displayTag: "科沃斯", aliases: ["科沃斯", "ECOVACS", "八界", "Bajie"] },
  unitree: { name: "宇树科技", displayTag: "宇树", aliases: ["宇树", "Unitree", "Go2", "B2", "H1", "G1"] },
  agibot: { name: "智元机器人", displayTag: "智元", aliases: ["智元", "AgiBot", "远征", "灵犀"] },
  ubtech: { name: "优必选", displayTag: "优必选", aliases: ["优必选", "UBTECH", "Walker"] },
  figure: { name: "Figure AI", displayTag: "Figure", aliases: ["Figure AI", "Figure 02", "Figure 03", "Helix"] },
  tesla: { name: "特斯拉", displayTag: "特斯拉", aliases: ["特斯拉", "Tesla", "Optimus", "擎天柱"] },
  "boston-dynamics": { name: "波士顿动力", displayTag: "波士顿动力", aliases: ["波士顿动力", "Boston Dynamics", "Atlas", "Spot", "Stretch"] },
  agility: { name: "Agility Robotics", displayTag: null, aliases: ["Agility Robotics", "Digit"] },
  apptronik: { name: "Apptronik", displayTag: null, aliases: ["Apptronik", "Apollo"] },
  "1x": { name: "1X Technologies", displayTag: null, aliases: ["1X Technologies", "1X Robotics"] },
  "physical-intelligence": { name: "Physical Intelligence", displayTag: null, aliases: ["Physical Intelligence", "物理智能", "π0"] },
  "skild-ai": { name: "Skild AI", displayTag: null, aliases: ["Skild AI"] },
  galbot: { name: "银河通用", displayTag: null, aliases: ["银河通用", "Galbot"] },
  fourier: { name: "傅利叶智能", displayTag: null, aliases: ["傅利叶", "Fourier", "GR-1", "GR-2"] },
  "x-humanoid": { name: "北京人形机器人创新中心", displayTag: null, aliases: ["北京人形", "X-Humanoid", "天工"] },
  nvidia: { name: "NVIDIA", displayTag: "NVIDIA", aliases: ["NVIDIA", "英伟达", "Isaac", "Jetson", "Thor"] },
  google: { name: "Google / DeepMind", displayTag: "Google", aliases: ["Google", "DeepMind", "Gemini Robotics", "谷歌"] },
  qwen: { name: "千问 Qwen", displayTag: null, aliases: ["Qwen", "通义", "千问", "阿里"] },
  deepseek: { name: "DeepSeek", displayTag: "DeepSeek", aliases: ["DeepSeek", "深度求索"] },
  openai: { name: "OpenAI", displayTag: "OpenAI", aliases: ["OpenAI", "ChatGPT", "Sora", "Codex"] },
};

/**
 * 身份词典：摘要和标题里出现的公司，必须在原文里也出现过，否则退回原标题、丢掉摘要（防止模型张冠李戴）。
 * 行业没有这个问题时可以留空数组。
 */
export const IDENTITY_LEXICON: ReadonlyArray<{ id: string; name: string; patterns: RegExp[] }> = [
  { id: "ecovacs", name: "科沃斯", patterns: [/科沃斯|\becovacs\b|\bbajie\b/i] },
  { id: "unitree", name: "宇树科技", patterns: [/宇树|unitree|\bgo2\b|\bb2\b|\bh1\b|\bg1\b/i] },
  { id: "agibot", name: "智元机器人", patterns: [/智元|\bagibot\b|远征\s?[a-z]?\d?|灵犀/i] },
  { id: "ubtech", name: "优必选", patterns: [/优必选|\bubtech\b|\bwalker\b/i] },
  { id: "figure", name: "Figure AI", patterns: [/\bfigure\s?ai\b|\bfigure\s?0[23]\b/i] },
  { id: "tesla", name: "特斯拉", patterns: [/特斯拉|\btesla\b|\boptimus\b|擎天柱/i] },
  { id: "boston-dynamics", name: "波士顿动力", patterns: [/波士顿动力|boston\s?dynamics|\batlas\b|\bspot\b|\bstretch\b/i] },
  { id: "agility", name: "Agility Robotics", patterns: [/agility\s?robotics|\bdigit\b/i] },
  { id: "apptronik", name: "Apptronik", patterns: [/apptronik/i] },
  { id: "1x", name: "1X Technologies", patterns: [/\b1x\s?(technologies|robotics)\b/i] },
  { id: "physical-intelligence", name: "Physical Intelligence", patterns: [/physical\s?intelligence|物理智能/i] },
  { id: "skild-ai", name: "Skild AI", patterns: [/skild\s?ai/i] },
  { id: "galbot", name: "银河通用", patterns: [/银河通用|\bgalbot\b/i] },
  { id: "fourier", name: "傅利叶智能", patterns: [/傅利叶|\bfourier\b|\bgr-[12]\b/i] },
  { id: "x-humanoid", name: "北京人形机器人创新中心", patterns: [/北京人形|\bx-?humanoid\b|天工/] },
  { id: "nvidia", name: "NVIDIA", patterns: [/nvidia|英伟达|\bisaac\b|\bjetson\b/i] },
  { id: "google", name: "Google / DeepMind", patterns: [/google|deepmind|gemini\s?robotics|谷歌/i] },
  { id: "qwen", name: "千问 Qwen", patterns: [/\bqwen|通义|千问/i] },
  { id: "deepseek", name: "DeepSeek", patterns: [/deepseek|深度求索/i] },
  { id: "openai", name: "OpenAI", patterns: [/openai|chatgpt|\bgpt-?[o\d]|\bsora\b/i] },
];

/** 这些域名上的文章，发布方就是对应的公司（托管平台如 GitHub、arXiv 不算）。 */
export const PUBLISHER_DOMAINS: ReadonlyArray<{ entityId: string; domains: readonly string[] }> = [
  { entityId: "ecovacs", domains: ["ecovacs.com", "ecovacs-tech.com"] },
  { entityId: "unitree", domains: ["unitree.com"] },
  { entityId: "agibot", domains: ["agibot.com"] },
  { entityId: "ubtech", domains: ["ubtrobot.com"] },
  { entityId: "figure", domains: ["figure.ai"] },
  { entityId: "tesla", domains: ["tesla.com"] },
  { entityId: "boston-dynamics", domains: ["bostondynamics.com"] },
  { entityId: "agility", domains: ["agilityrobotics.com"] },
  { entityId: "apptronik", domains: ["apptronik.com"] },
  { entityId: "nvidia", domains: ["nvidia.com"] },
  { entityId: "google", domains: ["deepmind.google", "ai.google", "blog.google"] },
  { entityId: "qwen", domains: ["qwen.ai"] },
];

/** 原文里的这些写法也算提到了对应公司。 */
export const IDENTITY_CONTEXT_ALIASES: ReadonlyArray<{ entityId: string; pattern: RegExp }> = [
  { entityId: "ecovacs", pattern: /@ECOVACS\b/i },
  { entityId: "unitree", pattern: /@Unitree\b/i },
  { entityId: "figure", pattern: /@figureai\b/i },
];
