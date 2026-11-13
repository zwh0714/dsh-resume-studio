/**
 * 骨架生成：cli init 与 resume_init 共用同一份实现。
 *
 * 此前两处各抄了一份骨架，改字段名要改两个地方，且中文键名写死。
 * 现在按 lang 取文案，字段随语言变化。
 */
import { localeOf, normalizeLang } from './locale.js'

/**
 * @param {object} opts { name?, intent?, lang? }
 * @returns {object} 可直接交给 normalize() 的简历对象
 */
export function buildSkeleton(opts = {}) {
  const lang = normalizeLang(opts.lang)
  const L = localeOf(lang)
  const s = L.samples

  return {
    meta: { template: 'classic', maxPages: 2, lang },
    basics: {
      name: opts.name || (lang === 'en' ? 'Your Name' : '你的姓名'),
      intent: opts.intent || L.defaultIntent,
      fields: L.fields.map((f) => [...f]),
    },
    sections: [
      {
        kind: 'timeline',
        title: L.sections.work,
        items: [
          {
            head: s.company,
            sub: s.role,
            date: s.dateNow,
            bullets: [s.workBullet],
          },
        ],
      },
      { kind: 'list', title: L.sections.skills, bullets: [s.skillBullet] },
      {
        kind: 'project',
        title: L.sections.project,
        items: [
          {
            head: lang === 'en' ? 'Project Name' : '项目名称',
            sub: lang === 'en' ? 'Core contributor' : '核心开发',
            date: s.dateProject,
            intro: s.projectIntro,
            label: s.projectLabel,
            bullets: [s.projectBullet],
          },
        ],
      },
    ],
  }
}
