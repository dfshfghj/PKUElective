import customtkinter as ctk


class ThemedTextBox(ctk.CTkTextbox):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        self._tag_configs = {}
        self._bind_theme_listener()

    def tag_config(self, tag_name, **kwargs):
        """支持 foreground=(light, dark), background=(light, dark)"""
        self._tag_configs[tag_name] = kwargs.copy()
        self._apply_tag_colors(tag_name, kwargs)

    def _apply_tag_colors(self, tag_name, options):
        mode = ctk.get_appearance_mode().lower()
        index = 1 if mode == "dark" else 0

        updated = {}
        for key in ['foreground', 'background', 'selectforeground', 'selectbackground']:
            if key in options:
                value = options[key]
                if isinstance(value, (list, tuple)) and len(value) == 2:
                    updated[key] = value[index]
                else:
                    updated[key] = value

        self._textbox.tag_configure(tag_name, **updated)

    def _bind_theme_listener(self):


        original_func = ctk.set_appearance_mode

        def new_func(mode):
            result = original_func(mode)
            self._on_theme_changed()
            return result

        ctk.set_appearance_mode = new_func
        ctk._theme_change_bound = True

    def _on_theme_changed(self):
        for tag_name, options in self._tag_configs.items():
            self._apply_tag_colors(tag_name, options)


def main():
    ctk.set_appearance_mode("dark")
    ctk.set_default_color_theme("blue")

    app = ctk.CTk()
    app.title("支持主题切换的日志框")
    app.geometry("600x500")

    text = ThemedTextBox(app, width=500, height=400)
    text.grid(row=0, column=0, padx=20, pady=20, sticky="nsew")

    text.tag_config('time',      foreground=('gray50', 'gray70'))
    text.tag_config('debug',     foreground=('gray40', 'gray60'))
    text.tag_config('info',      foreground=('#0066cc', '#3399ff'))
    text.tag_config('warning',   foreground=('#804000', '#ffc107'),
                                   background=('#fffacd', '#3b3605'))
    text.tag_config('success',   foreground=('#006600', '#00cc00'),
                                   background=('#e6ffe6', '#003300'))
    text.tag_config('critical',  foreground=('#cc0000', '#ff0000'),
                                   background=('#ffe6e6', '#ffeeee'))

    log_data = [
        ("[10:00:00] 启动服务", "time"),
        ("调试：数据库连接成功", "debug"),
        ("用户 admin 登录", "info"),
        ("警告：磁盘使用率 >80%", "warning"),
        ("操作已完成", "success"),
        ("致命错误：权限拒绝", "critical")
    ]

    for msg, tag in log_data:
        text.insert("end", msg + "\n", tag)

    # 测试主题切换
    def toggle_mode():
        mode = ctk.get_appearance_mode()
        ctk.set_appearance_mode("light" if mode == "dark" else "dark")

    btn = ctk.CTkButton(app, text="切换主题", command=toggle_mode)
    btn.grid(row=1, column=0, pady=10)

    app.mainloop()


if __name__ == "__main__":
    main()