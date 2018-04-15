export default () => {
  const templates = {};
  const templateElements = document.querySelectorAll(".template");
  for (let template of templateElements) {
    templates[template.dataset.templateId] = template.innerHTML
  }
  return templates;
}
