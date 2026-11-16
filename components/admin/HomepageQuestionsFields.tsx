"use client";

import type { HomepageQuestions } from "@/lib/homepage-builder";

export default function HomepageQuestionsFields({ value, onChange, disabled }: { value: HomepageQuestions; onChange: (value: HomepageQuestions) => void; disabled: boolean }) {
  function updateItem(index: number, patch: Partial<HomepageQuestions["items"][number]>) {
    onChange({ ...value, items: value.items.map((item, i) => i === index ? { ...item, ...patch } : item) });
  }
  return <>
    <div className="field"><label className="label" htmlFor="questions-top">Heading, first line</label><input id="questions-top" className="input" maxLength={100} value={value.titleTop} disabled={disabled} onChange={event => onChange({ ...value, titleTop: event.target.value })} /></div>
    <div className="field"><label className="label" htmlFor="questions-bottom">Heading, second line</label><input id="questions-bottom" className="input" maxLength={100} value={value.titleBottom} disabled={disabled} onChange={event => onChange({ ...value, titleBottom: event.target.value })} /></div>
    <div className="field"><label className="label" htmlFor="questions-intro">Introduction</label><textarea id="questions-intro" className="textarea" maxLength={350} value={value.introduction} disabled={disabled} onChange={event => onChange({ ...value, introduction: event.target.value })} /></div>
    {value.items.map((item, index) => <div className="admin-faq-item" key={index}>
      <label className="label" htmlFor={`existing-question-${index}`}>Question {index + 1}</label><input id={`existing-question-${index}`} className="input" maxLength={160} value={item.question} disabled={disabled} onChange={event => updateItem(index, { question: event.target.value })} />
      <label className="label" htmlFor={`existing-answer-${index}`}>Answer {index + 1}</label><textarea id={`existing-answer-${index}`} className="textarea" maxLength={600} value={item.answer} disabled={disabled} onChange={event => updateItem(index, { answer: event.target.value })} />
      <label className="label" htmlFor={`existing-link-text-${index}`}>Link text (optional)</label><input id={`existing-link-text-${index}`} className="input" maxLength={60} value={item.linkText} disabled={disabled} onChange={event => updateItem(index, { linkText: event.target.value })} />
      <label className="label" htmlFor={`existing-link-${index}`}>Link destination (optional)</label><input id={`existing-link-${index}`} className="input" maxLength={300} value={item.link} disabled={disabled} onChange={event => updateItem(index, { link: event.target.value })} /><span className="hint">Use a page on your website, such as /contact.</span>
      <button type="button" className="btn btn-light" disabled={disabled} onClick={() => onChange({ ...value, items: value.items.filter((_, i) => i !== index) })}>Remove question {index + 1}</button>
    </div>)}
    <div className="admin-editor-actions"><button type="button" className="btn btn-light" disabled={disabled || value.items.length >= 6} onClick={() => onChange({ ...value, items: [...value.items, { question: "", answer: "", linkText: "", link: "" }] })}>Add question</button></div>
  </>;
}
