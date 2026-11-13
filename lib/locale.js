/**
 * 本地化：把此前写死的中文文案集中到一处。
 *
 * 接入点：
 *   - 骨架字段名与模块名（cli init / resume_init）
 *   - 产物文件名后缀（api.renderResume）
 *   - HTML <html lang> 与 <title>
 *   - DOCX 页脚页码
 */

export const LANGUAGES = ['zh', 'en']

export const LOCALE = {
  zh: {
    tag: 'zh-CN',
    resumeSuffix: '简历',
    titleSuffix: '简历',
    pagePrefix: '第 ',
    pageSuffix: ' 页',
    colon: '：',
    defaultIntent: '求职意向：后端开发工程师',
    fields: [
      ['电话', '13800000000'],
      ['邮箱', 'name@example.com'],
      ['工作年限', '3 年'],
      ['学历', '本科'],
    ],
    sections: {
      work: '工作经历',
      project: '项目经历',
      skills: '专业技能',
    },
    samples: {
      role: '后端开发工程师',
      company: '公司名称',
      degree: '本科',
      years: '3 年',
      projectIntro: '**项目介绍：**面向 B 端的订单履约中台，支撑日均 200 万单。',
      projectLabel: '职责与成果：',
      workBullet: '主导 **订单中心** 重构，把接口 P99 从 800ms 降到 220ms，线上超时告警下降 **85%**',
      skillBullet: '**后端**：熟悉 Java、Spring Boot，掌握 MySQL 索引优化与 Redis 缓存设计',
      projectBullet: '**履约链路**：拆分超时任务，把平均履约时长压缩 30%',
      dateNow: '2022.07 - 至今',
      dateProject: '2023.03 - 2023.12',
    },
  },
  en: {
    tag: 'en',
    resumeSuffix: 'Resume',
    titleSuffix: 'Resume',
    pagePrefix: 'Page ',
    pageSuffix: '',
    colon: ': ',
    defaultIntent: 'Target role: Backend Engineer',
    fields: [
      ['Phone', '+1 555 000 0000'],
      ['Email', 'name@example.com'],
      ['Experience', '3 years'],
      ['Education', "Bachelor's"],
    ],
    sections: {
      work: 'Experience',
      project: 'Projects',
      skills: 'Skills',
    },
    samples: {
      role: 'Backend Engineer',
      company: 'Company Name',
      degree: "Bachelor's",
      years: '3 years',
      projectIntro: '**Project:** A B2B order fulfilment platform handling 2M orders per day.',
      projectLabel: 'Responsibilities & impact:',
      workBullet:
        'Led the **order service** rewrite, cutting p99 latency from 800ms to 220ms and timeout alerts by **85%**',
      skillBullet:
        '**Backend:** Java, Spring Boot; MySQL index tuning and Redis cache design',
      projectBullet:
        '**Fulfilment pipeline:** split the timeout jobs and cut average fulfilment time by 30%',
      dateNow: '2022.07 - Present',
      dateProject: '2023.03 - 2023.12',
    },
  },
}

/** 未知值一律回落 zh，保证任何输入都有可用文案 */
export function localeOf(lang) {
  const key = String(lang ?? '').trim().toLowerCase()
  return LOCALE[key] || LOCALE.zh
}

export function normalizeLang(lang) {
  const key = String(lang ?? '').trim().toLowerCase()
  return LANGUAGES.includes(key) ? key : 'zh'
}

/** 产物文件名：<姓名>-简历 / <姓名>-Resume */
export function resumeFileName(name, lang) {
  return `${name}-${localeOf(lang).resumeSuffix}`
}
