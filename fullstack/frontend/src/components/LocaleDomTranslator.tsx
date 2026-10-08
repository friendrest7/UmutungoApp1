'use client';

import { useEffect, useRef } from 'react';
import { t } from '../data/translations';
import { usePersistentLanguage } from '../lib/language';

type PreviousTranslation = { source: string; translated: string };
const translatedAttributes = ['placeholder', 'aria-label', 'title', 'alt'];

export function LocaleDomTranslator() {
  const { language } = usePersistentLanguage();
  const textHistory = useRef(new WeakMap<Text, PreviousTranslation>());
  const attributeHistory = useRef(new WeakMap<Element, Map<string, PreviousTranslation>>());

  useEffect(() => {
    const root = document.body;
    const translateText = (node: Text) => {
      const parent = node.parentElement;
      if (!parent || parent.closest('script,style,noscript,code,pre,[contenteditable="true"],[data-no-translate]')) return;
      const current = node.data;
      const previous = textHistory.current.get(node);
      const source = previous && current === previous.translated ? previous.source : current;
      const leading = source.match(/^\s*/)?.[0] ?? '';
      const trailing = source.match(/\s*$/)?.[0] ?? '';
      const content = source.slice(leading.length, source.length - trailing.length);
      if (!content) return;
      const translated = t(language, content);
      if (translated === content) {
        if (previous && current !== source) node.data = source;
        textHistory.current.delete(node);
        return;
      }
      const output = `${leading}${translated}${trailing}`;
      textHistory.current.set(node, { source, translated: output });
      if (node.data !== output) node.data = output;
    };

    const translateElement = (element: Element) => {
      if (element.closest('[data-no-translate]')) return;
      for (const attribute of translatedAttributes) {
        if (!element.hasAttribute(attribute)) continue;
        const current = element.getAttribute(attribute) ?? '';
        let history = attributeHistory.current.get(element);
        if (!history) { history = new Map(); attributeHistory.current.set(element, history); }
        const previous = history.get(attribute);
        const source = previous && current === previous.translated ? previous.source : current;
        const translated = t(language, source);
        if (translated === source) {
          if (previous && current !== source) element.setAttribute(attribute, source);
          history.delete(attribute);
        } else if (translated !== current) {
          history.set(attribute, { source, translated });
          element.setAttribute(attribute, translated);
        }
      }
    };

    const visit = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) translateText(node as Text);
      else if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as Element;
        translateElement(element);
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        let text: Node | null;
        while ((text = walker.nextNode())) translateText(text as Text);
        for (const child of Array.from(element.querySelectorAll('*'))) translateElement(child);
      }
    };

    visit(root);
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === 'characterData') translateText(record.target as Text);
        else if (record.type === 'attributes') translateElement(record.target as Element);
        else record.addedNodes.forEach(visit);
      }
    });
    observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: translatedAttributes });
    return () => observer.disconnect();
  }, [language]);

  return null;
}
