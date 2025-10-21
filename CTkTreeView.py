import customtkinter as ctk


class CTkTreeView(ctk.CTkFrame):
    def __init__(self, master, columns=None, show='headings', height=10):
        super().__init__(master, fg_color="transparent")
        self.show = show
        self.height = height
        self._columns = {}
        self._col_order = []
        self._rows = {}  # item_id -> {cells: {}, values: []}
        self._selected_item = None
        self._on_double_click = None
        self._min_widths = {}

        if columns is not None:
            for col in columns:
                self._columns[col] = {'text': '', 'anchor': 'w'}
                self._min_widths[col] = 100
            if '#0' not in columns:
                self._min_widths['#0'] = 250
        else:
            self._columns['#0'] = {'text': '', 'anchor': 'w'}
            self._min_widths['#0'] = 250

        if 'headings' not in self.show:
            self._col_order = list(self._columns.keys())
        else:
            self._col_order = [col for col in self._columns.keys() if col != '#0']

        self._current_row_index = 0

        self._header_widgets = []
        self._cell_widgets = []

        self._draw_headers()
        self._set_height()

    def _set_height(self):
        row_height = 30
        total_height = min(self.height * row_height, 600)
        self.configure(height=total_height)

    def _draw_headers(self):
        for i, col in enumerate(self._col_order):
            conf = self._columns[col]
            anchor = conf['anchor']
            justify = 'left' if anchor == 'w' else 'right' if anchor == 'e' else 'center'

            label = ctk.CTkLabel(
                self,
                text=conf['text'],
                font=("Arial", 12, "bold"),
                anchor=anchor,
                justify=justify,
                fg_color=("#dfe6e9", "#2d3436") if col != '#0' else "transparent",
                text_color=("#2d3436", "#dfe6e9"),
                corner_radius=4,
                pady=4
            )
            label.grid(row=0, column=i, padx=(0, 1) if i < len(self._col_order)-1 else 0, sticky="ew")
            self._header_widgets.append(label)

            self.grid_columnconfigure(i, weight=1)
            self.column(col, width=self._min_widths.get(col, 100))

        self._current_row_index = 1

    def heading(self, col, text=None):
        if col not in self._columns or text is None:
            return
        self._columns[col]['text'] = text
        self._clear_headers()
        self._draw_headers()

    def column(self, col, width=None, anchor=None, **kwargs):
        if col not in self._columns:
            return
        if anchor is not None:
            self._columns[col]['anchor'] = anchor
        if width is not None:
            self._min_widths[col] = width
            try:
                idx = self._col_order.index(col)
                self.grid_columnconfigure(idx, minsize=width)
            except ValueError:
                pass

    def insert(self, parent, index, text='', values=()):
        item_id = f"I{len(self._rows):03X}"
        all_values = [text] + (list(values) if isinstance(values, (list, tuple)) else [])

        cells = {}

        for i, col in enumerate(self._col_order):
            value = all_values[i] if i < len(all_values) else ""
            conf = self._columns[col]
            anchor = conf['anchor']
            justify = 'left' if anchor == 'w' else 'right' if anchor == 'e' else 'center'

            label = ctk.CTkLabel(
                self,
                text=str(value),
                font=("Arial", 12),
                anchor=anchor,
                justify=justify,
                fg_color="transparent"
            )
            label.grid(
                row=self._current_row_index,
                column=i,
                padx=(0, 1) if i < len(self._col_order)-1 else 0,
                sticky="ew",
                pady=1
            )
            cells[col] = label
            self._cell_widgets.append((label, item_id))

        self._rows[item_id] = {
            'cells': cells,
            'values': all_values,
            'row_index': self._current_row_index
        }

        self._bind_row_events(item_id)
        self._current_row_index += 1
        return item_id

    def delete(self, *items):
        if not items:
            return
        if items == ('all',):
            items = self.get_children()

        for item_id in items:
            if item_id in self._rows:
                for cell in self._rows[item_id]['cells'].values():
                    cell.destroy()
                del self._rows[item_id]

        self._regrid_rows()

    def _regrid_rows(self):
        sorted_items = sorted(self._rows.items(), key=lambda x: x[1]['row_index'])
        new_row_idx = 1
        for item_id, data in sorted_items:
            for col, widget in data['cells'].items():
                widget.grid_configure(row=new_row_idx)
            data['row_index'] = new_row_idx
            new_row_idx += 1
        self._current_row_index = new_row_idx

    def get_children(self):
        return list(self._rows.keys())

    def focus(self):
        return self._selected_item or ""

    def item(self, item_id, **kwargs):
        if item_id not in self._rows:
            return {}
        row = self._rows[item_id]
        if not kwargs:
            return {'text': row['values'][0], 'values': tuple(row['values'][1:])}
        if 'values' in kwargs:
            new_vals = [row['values'][0]] + list(kwargs['values'])
            for i, col in enumerate(self._col_order):
                if i < len(new_vals):
                    self._rows[item_id]['cells'][col].configure(text=str(new_vals[i]))
            row['values'] = new_vals
        if 'text' in kwargs:
            row['values'][0] = kwargs['text']
            self._rows[item_id]['cells'][self._col_order[0]].configure(text=kwargs['text'])

    def bind(self, event, handler, add=None):
        if event == '<Double-Button-1>':
            self._on_double_click = handler
        return self

    def yview(self, *args):
        pass  # handled by scrollable frame

    def refresh(self):
        self.delete('all')
        self._clear_headers()
        self._draw_headers()

    def _clear_headers(self):
        for w in self._header_widgets:
            w.destroy()
        self._header_widgets.clear()

    def _bind_row_events(self, item_id):
        def on_click(e):
            if self._selected_item and self._selected_item in self._rows:
                for cell in self._rows[self._selected_item]['cells'].values():
                    cell.configure(fg_color="transparent")
            self._selected_item = item_id
            for cell in self._rows[item_id]['cells'].values():
                cell.configure(fg_color=("#BBDCF1", "#1C5F9A"))

        def on_double(e):
            self._selected_item = item_id
            if self._on_double_click:
                self._on_double_click(e)

        def on_enter(e):
            if self._selected_item != item_id:
                for cell in self._rows[item_id]['cells'].values():
                    cell.configure(fg_color=("#f5f6fa", "#3a3b3c"))

        def on_leave(e):
            if self._selected_item != item_id:
                for cell in self._rows[item_id]['cells'].values():
                    cell.configure(fg_color="transparent")

        row_cells = list(self._rows[item_id]['cells'].values())
        for widget in row_cells:
            widget.bind("<Button-1>", on_click)
            widget.bind("<Double-Button-1>", on_double)
            widget.bind("<Enter>", on_enter)
            widget.bind("<Leave>", on_leave)
