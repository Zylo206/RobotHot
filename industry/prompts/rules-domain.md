
【具身智能领域翻译规则 — 本平台是机器人/具身智能行业内容，严格遵守】

1. 歧义默认值：以下词在中文有非机器人歧义，**一律按具身智能含义翻译**：
   - Humanoid = 人形机器人（不译"类人的"）
   - Embodied AI = 具身智能（不译"具体化的人工智能"）
   - VLA（Vision-Language-Action）= 视觉-语言-动作模型（保留英文缩写）
   - Sim2Real = Sim2Real（仿真到真实；保留英文，可注"仿真到现实迁移"）
   - Teleoperation = 遥操作（不译"远程手术"以外的日常义）
   - Dexterous hand = 灵巧手
   - End-effector = 末端执行器
   - Locomotion = 运动控制/移动能力（机器人语境）
   - Manipulation = 操作（机器人语境，不译"操纵"）
   - Actuator = 执行器；Joint = 关节；DoF（Degrees of Freedom）= 自由度
   - Inference = 推理（模型生成，机器人"大脑"语境）
   - Fine-tune / Fine-tuning = 微调
   - Distillation = 知识蒸馏
   - Hallucination = 模型幻觉
   - Prompt = 提示词
   - Agent = 智能体（机器人调度语境）

2. 以下专有名词**一律保留英文原文**，不翻译不加中文括注：
   - 机器人公司：ECOVACS（科沃斯）/ Unitree（宇树科技）/ AgiBot（智元机器人）/ UBTECH（优必选）/ Figure AI / Tesla / Boston Dynamics / Agility Robotics / Apptronik / 1X / Physical Intelligence / Skild AI / Galbot（银河通用）/ Fourier（傅利叶智能）/ X-Humanoid（北京人形机器人创新中心）/ NVIDIA / Google DeepMind
   - 模型族与平台（举例 + 通用规则）：π0 / Helix / GR00T / Gemini Robotics / RT-1 / RT-2 / OpenVLA / RDT / Qwen / DeepSeek / GPT
     **规则**：任何具身模型族名、产品代号一律保留英文
   - 整机型号（举例 + 通用规则）：Optimus / Atlas / Digit / Apollo / NEO / Walker / 天工 / 远征 A2 / 灵犀 X2 / Go2 / B2 / H1 / G1 / GR-1 / GR-2 / Spot / Stretch
     **规则**：型号一字不改，中文品牌型号（远征、灵犀、天工）按官方写法保留
   - 技术缩写（举例 + 通用规则）：VLA / DoF / IMU / RL / SLAM / ROS / URDF / MPC / Sim2Real / LiDAR / ToF / GPU / NPU / API / SDK
     **规则**：2-5 字母全大写缩写默认按机器人/具身智能含义保留英文
   - 评测基准（举例 + 通用规则）：RLBench / CALVIN / LIBERO / SimplerEnv / RoboCasa
     **规则**：全大写或以 -bench / -eval 结尾的评测名一律保留英文
   - 仿真与开发工具：Isaac Sim / Isaac Lab / MuJoCo / Gazebo / PyBullet / LeRobot / ROS 2 / MoveIt / Habitat
   - 通用技术：API / SDK / CLI / IDE / SaaS / CDN / SSO / OAuth / JWT / WebSocket / gRPC

3. 中国厂商**优先用官方中文品牌名**（首次出现可双标"宇树科技（Unitree）"，后续选一种保持一致）：
   - 科沃斯（ECOVACS）/ 宇树科技（Unitree）/ 智元机器人（AgiBot）/ 优必选（UBTECH）/ 银河通用（Galbot）/ 傅利叶智能（Fourier）/ 北京人形机器人创新中心（X-Humanoid）/ 千问（Qwen）/ 深度求索（DeepSeek）

4. 代码 / 命令 / URL / 数字单位 **一字不改**保留：
   - 反引号代码 `code` 不翻译
   - 命令如 ros2 launch、pip install、npm run 不译
   - URL 原样
   - 数字+单位：27 DoF / 5 kg payload / 2 m/s / 8h battery / 99.9% / ¥99,000
   - 金额、自由度、负载、速度、续航、比例、区间必须保留原文的阿拉伯数字和单位；不要把 "27 DoF" 改写成“二十七个自由度”
