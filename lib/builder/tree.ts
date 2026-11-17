/**
 * Immutable tree operations for the visual editor.
 *
 * Every function returns a new layout and never mutates its input, which is
 * what makes undo, redo and discarding a draft reliable.
 */
import {
  BUILDER_LIMITS,
  countNodes,
  newId,
  newWidget,
  type BuilderLayout,
  type BuilderNode,
  type ColumnNode,
  type SectionNode,
  type WidgetNode,
} from "./schema";

export function findNode(layout: BuilderLayout, id: string): BuilderNode | null {
  for (const section of layout.sections) {
    if (section.id === id) return section;
    for (const column of section.columns) {
      if (column.id === id) return column;
      for (const widget of column.widgets) if (widget.id === id) return widget;
    }
  }
  return null;
}

export function findSectionOf(layout: BuilderLayout, id: string): SectionNode | null {
  for (const section of layout.sections) {
    if (section.id === id) return section;
    for (const column of section.columns) {
      if (column.id === id) return section;
      for (const widget of column.widgets) if (widget.id === id) return section;
    }
  }
  return null;
}

/** Rebuilds the tree with `updater` applied to the node with `id`. */
export function updateNode(
  layout: BuilderLayout,
  id: string,
  updater: (node: BuilderNode) => BuilderNode
): BuilderLayout {
  return {
    ...layout,
    sections: layout.sections.map((section) => {
      if (section.id === id) return updater(section) as SectionNode;
      return {
        ...section,
        columns: section.columns.map((column) => {
          if (column.id === id) return updater(column) as ColumnNode;
          return {
            ...column,
            widgets: column.widgets.map((widget) =>
              widget.id === id ? (updater(widget) as WidgetNode) : widget
            ),
          };
        }),
      };
    }),
  };
}

/** Removes a widget or column. Sections are removed with `removeSection`. */
export function removeNode(layout: BuilderLayout, id: string): BuilderLayout {
  return {
    ...layout,
    sections: layout.sections
      .filter((section) => section.id !== id)
      .map((section) => ({
        ...section,
        columns: section.columns
          .filter((column) => column.id !== id)
          .map((column) => ({
            ...column,
            widgets: column.widgets.filter((widget) => widget.id !== id),
          })),
      }))
      .filter((section) => section.columns.length > 0)
  };
}

export function insertSection(layout: BuilderLayout, section: SectionNode, index = layout.sections.length): BuilderLayout {
  if (layout.sections.length >= BUILDER_LIMITS.sections) return layout;
  const sections = [...layout.sections];
  sections.splice(Math.max(0, Math.min(index, sections.length)), 0, section);
  const next = { ...layout, sections };
  return countNodes(next) > BUILDER_LIMITS.nodes ? layout : next;
}

export function insertColumn(layout: BuilderLayout, sectionId: string, column: ColumnNode): BuilderLayout {
  const section = layout.sections.find((entry) => entry.id === sectionId);
  if (!section || section.columns.length >= BUILDER_LIMITS.columns) return layout;
  return updateNode(layout, sectionId, (node) => {
    const target = node as SectionNode;
    const columns = [...target.columns, column];
    // Share the row evenly; every column gets the same share of the row.
    const share = Math.round(100 / columns.length);
    return {
      ...target,
      columns: columns.map((entry) => ({
        ...entry,
        style: { ...entry.style, desktop: { ...entry.style.desktop, columnWidth: share } },
      })),
    };
  });
}

export function insertWidget(
  layout: BuilderLayout,
  columnId: string,
  widget: WidgetNode,
  index?: number
): BuilderLayout {
  const column = layout.sections.flatMap((section) => section.columns).find((entry) => entry.id === columnId);
  if (!column || column.widgets.length >= BUILDER_LIMITS.widgets) return layout;
  return updateNode(layout, columnId, (node) => {
    const target = node as ColumnNode;
    const widgets = [...target.widgets];
    widgets.splice(index === undefined ? widgets.length : Math.max(0, Math.min(index, widgets.length)), 0, widget);
    return { ...target, widgets };
  });
}

/** Moves a widget to another column, or reorders it inside its own. */
export function moveWidget(
  layout: BuilderLayout,
  widgetId: string,
  targetColumnId: string,
  index?: number
): BuilderLayout {
  const widget = findNode(layout, widgetId);
  if (!widget || widget.kind === "section" || widget.kind === "column") return layout;
  const currentColumn = layout.sections
    .flatMap((section) => section.columns)
    .find((column) => column.widgets.some((entry) => entry.id === widgetId));
  const target = layout.sections.flatMap((section) => section.columns).find((column) => column.id === targetColumnId);
  if (!currentColumn || !target) return layout;

  const currentIndex = currentColumn.widgets.findIndex((entry) => entry.id === widgetId);
  let destination = index === undefined ? target.widgets.length : index;
  if (currentColumn.id === target.id && currentIndex < destination) destination -= 1;

  if (currentColumn.id === target.id && (destination === currentIndex || destination < 0)) {
    const widgets = [...currentColumn.widgets];
    widgets.splice(currentIndex, 1);
    widgets.splice(Math.max(0, Math.min(destination, widgets.length)), 0, widget);
    return updateNode(layout, currentColumn.id, (node) => ({ ...(node as ColumnNode), widgets }));
  }

  const without = updateNode(layout, currentColumn.id, (node) => ({
    ...(node as ColumnNode),
    widgets: (node as ColumnNode).widgets.filter((entry) => entry.id !== widgetId),
  }));
  return insertWidget(without, targetColumnId, widget, destination);
}

/** Shifts a node one place within its own parent list. */
export function moveNodeWithin(layout: BuilderLayout, id: string, delta: -1 | 1): BuilderLayout {
  const sectionIndex = layout.sections.findIndex((section) => section.id === id);
  if (sectionIndex >= 0) {
    const target = sectionIndex + delta;
    if (target < 0 || target >= layout.sections.length) return layout;
    const sections = [...layout.sections];
    const [moved] = sections.splice(sectionIndex, 1);
    sections.splice(target, 0, moved);
    return { ...layout, sections };
  }

  for (const [index, section] of layout.sections.entries()) {
    const columnIndex = section.columns.findIndex((column) => column.id === id);
    if (columnIndex >= 0) {
      const target = columnIndex + delta;
      if (target < 0 || target >= section.columns.length) return layout;
      const columns = [...section.columns];
      const [moved] = columns.splice(columnIndex, 1);
      columns.splice(target, 0, moved);
      const sections = [...layout.sections];
      sections[index] = { ...section, columns };
      return { ...layout, sections };
    }

    for (const column of section.columns) {
      const widgetIndex = column.widgets.findIndex((widget) => widget.id === id);
      if (widgetIndex >= 0) {
        const target = widgetIndex + delta;
        if (target < 0 || target >= column.widgets.length) return layout;
        return updateNode(layout, column.id, (node) => {
          const widgets = [...(node as ColumnNode).widgets];
          const [moved] = widgets.splice(widgetIndex, 1);
          widgets.splice(target, 0, moved);
          return { ...(node as ColumnNode), widgets };
        });
      }
    }
  }
  return layout;
}

/** Copies a node and every id inside it, so the copy is independent. */
function cloneWithNewIds(node: BuilderNode): BuilderNode {
  if (node.kind === "section") {
    return {
      ...node,
      id: newId(),
      columns: node.columns.map((column) => cloneWithNewIds(column) as ColumnNode),
    };
  }
  if (node.kind === "column") {
    return {
      ...node,
      id: newId(),
      widgets: node.widgets.map((widget) => cloneWithNewIds(widget) as WidgetNode),
    };
  }
  return { ...node, id: newId() };
}

export function duplicateNode(layout: BuilderLayout, id: string): BuilderLayout {
  const sectionIndex = layout.sections.findIndex((section) => section.id === id);
  if (sectionIndex >= 0) {
    const copy = cloneWithNewIds(layout.sections[sectionIndex]) as SectionNode;
    return insertSection(layout, copy, sectionIndex + 1);
  }

  for (const section of layout.sections) {
    const columnIndex = section.columns.findIndex((column) => column.id === id);
    if (columnIndex >= 0 && section.columns.length < BUILDER_LIMITS.columns) {
      const copy = cloneWithNewIds(section.columns[columnIndex]) as ColumnNode;
      return updateNode(layout, section.id, (node) => {
        const target = node as SectionNode;
        const columns = [...target.columns];
        columns.splice(columnIndex + 1, 0, copy);
        return { ...target, columns };
      });
    }
    for (const column of section.columns) {
      const widgetIndex = column.widgets.findIndex((widget) => widget.id === id);
      if (widgetIndex >= 0) {
        const copy = cloneWithNewIds(column.widgets[widgetIndex]) as WidgetNode;
        const widgets = [...column.widgets];
        widgets.splice(widgetIndex + 1, 0, copy);
        return updateNode(layout, column.id, (node) => ({ ...(node as ColumnNode), widgets }));
      }
    }
  }
  return layout;
}

/** Adds a widget of `kind` to the end of a column. */
export function addWidget(layout: BuilderLayout, columnId: string, kind: Parameters<typeof newWidget>[0]): BuilderLayout {
  return insertWidget(layout, columnId, newWidget(kind));
}

/** Every column in the page, in reading order, for the palette targets. */
export function columnsOf(layout: BuilderLayout): ColumnNode[] {
  return layout.sections.flatMap((section) => section.columns);
}
