"""Generate PDF from airwallex-rfi-response.md using fpdf2"""
from fpdf import FPDF
import re
import os

base = os.path.dirname(os.path.abspath(__file__))
FONT_PATH = "C:/Windows/Fonts/msyh.ttc"
OUT_PATH = os.path.join(base, "airwallex-rfi-response.pdf")
SRC_PATH = os.path.join(base, "airwallex-rfi-response.md")

class MarkdownPDF(FPDF):
    def __init__(self):
        super().__init__('P', 'mm', 'A4')
        self.add_font('YaHei', '', FONT_PATH)
        self.add_font('YaHei', 'B', 'C:/Windows/Fonts/msyhbd.ttc')
        self.set_auto_page_break(True, 20)
        self.margin = 20
        self.w = 210 - 2 * self.margin  # usable width

    def header(self):
        pass  # no header

    def footer(self):
        self.set_y(-15)
        self.set_font('YaHei', '', 9)
        self.set_text_color(150, 150, 150)
        self.cell(0, 10, f'第 {self.page_no()} 页', align='C')

    def write_h1(self, text):
        self.ln(6)
        self.set_font('YaHei', 'B', 18)
        self.set_text_color(0, 0, 0)
        self.multi_cell(self.w, 10, text)
        # underline
        y = self.get_y()
        self.set_draw_color(22, 119, 255)
        self.set_line_width(0.6)
        self.line(self.margin, y + 1, self.margin + self.w, y + 1)
        self.ln(6)

    def write_h2(self, text):
        self.ln(4)
        self.set_font('YaHei', 'B', 14)
        self.set_text_color(22, 119, 255)
        self.multi_cell(self.w, 8, text)
        self.ln(2)

    def write_h3(self, text):
        self.ln(2)
        self.set_font('YaHei', 'B', 12)
        self.set_text_color(0, 0, 0)
        self.multi_cell(self.w, 7, text)
        self.ln(1)

    def write_para(self, text):
        # Skip if empty or whitespace only
        if not text or text.isspace():
            return
        self.set_font('YaHei', '', 10.5)
        self.set_text_color(34, 34, 34)
        # Process inline formatting
        text = self._process_inline(text)
        self.multi_cell(self.w, 6.5, text)
        self.ln(1)

    def write_bullet(self, text):
        self.set_font('YaHei', '', 10.5)
        self.set_text_color(34, 34, 34)
        indent = 6
        text = self._process_inline(text)
        # Multi-cell with indent
        self.set_x(self.margin + indent)
        self.multi_cell(self.w - indent, 6.5, '• ' + text)
        self.ln(0.5)

    def _process_inline(self, text):
        # Bold: **text** -> just strip the markers
        text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)
        # Code: `text` — use gray background color
        text = re.sub(r'`([^`]+)`', r'\1', text)
        # Links: keep text only
        text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)
        return text

    def write_code_block(self, lines):
        self.ln(2)
        self.set_fill_color(248, 248, 248)
        code_w = self.w - 8  # indent
        for line in lines:
            self.set_font('YaHei', '', 9)
            self.set_text_color(60, 60, 60)
            self.set_x(self.margin + 4)
            # Use multi_cell to wrap long lines
            self.multi_cell(code_w, 5.5, line, fill=True)
        self.ln(2)

    def write_table(self, headers, rows):
        self.ln(2)
        n = len(headers)
        col_w = self.w / n
        cell_h = 7
        x0 = self.margin

        # -- Header --
        self.set_font('YaHei', 'B', 9)
        self.set_text_color(0, 0, 0)
        self.set_fill_color(240, 245, 255)

        # Measure header height
        header_h = 0
        for h in headers:
            dry = self.multi_cell(col_w - 2, cell_h, h, dry_run=True, output='LINES')
            needed = len(dry) * cell_h
            if needed > header_h:
                header_h = needed

        y0 = self.get_y()
        if y0 + header_h > self.h - self.b_margin - 10:
            self.add_page()
            y0 = self.get_y()

        # Draw header
        for i, h in enumerate(headers):
            self.set_xy(x0 + i * col_w, y0)
            self.multi_cell(col_w, cell_h, h, border=0, fill=True)
            self.rect(x0 + i * col_w, y0, col_w, header_h)
        self.set_y(y0 + header_h)

        # -- Data rows --
        self.set_font('YaHei', '', 9)
        for row in rows:
            row_h = 0
            for c in row:
                dry = self.multi_cell(col_w - 2, cell_h, str(c), dry_run=True, output='LINES')
                needed = len(dry) * cell_h
                if needed > row_h:
                    row_h = needed

            y_row = self.get_y()
            if y_row + row_h > self.h - self.b_margin - 10:
                self.add_page()
                y_row = self.get_y()

            for i, cell_text in enumerate(row):
                self.set_xy(x0 + i * col_w, y_row)
                self.multi_cell(col_w, cell_h, str(cell_text), border=0)
                self.rect(x0 + i * col_w, y_row, col_w, row_h)
            self.set_y(y_row + row_h)

        self.ln(3)

    def write_hr(self):
        self.ln(4)
        y = self.get_y()
        self.set_draw_color(224, 224, 224)
        self.line(self.margin, y, self.margin + self.w, y)
        self.ln(4)

    def write_blockquote(self, text):
        self.set_font('YaHei', '', 10)
        self.set_text_color(85, 85, 85)
        self.set_draw_color(22, 119, 255)
        indent = 5
        self.set_x(self.margin + indent)
        self.multi_cell(self.w - indent - 3, 6.5, text)
        self.ln(1)


def parse_markdown(filepath):
    """Parse markdown into structured blocks"""
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    blocks = []
    i = 0
    while i < len(lines):
        line = lines[i].rstrip()
        if not line:
            i += 1
            continue

        # Code block
        if line.startswith('```'):
            code_lines = []
            i += 1
            while i < len(lines) and not lines[i].startswith('```'):
                code_lines.append(lines[i].rstrip())
                i += 1
            i += 1
            blocks.append(('code', code_lines))
            continue

        # Table
        if '|' in line and i + 1 < len(lines) and '---' in lines[i + 1]:
            headers = [c.strip() for c in line.split('|')[1:-1]]
            i += 2  # skip separator
            rows = []
            while i < len(lines) and '|' in lines[i]:
                rows.append([c.strip() for c in lines[i].split('|')[1:-1]])
                i += 1
            blocks.append(('table', {'headers': headers, 'rows': rows}))
            continue

        # Headings
        if line.startswith('# '):
            blocks.append(('h1', line[2:]))
            i += 1
            continue
        if line.startswith('## '):
            blocks.append(('h2', line[3:]))
            i += 1
            continue
        if line.startswith('### '):
            blocks.append(('h3', line[4:]))
            i += 1
            continue

        # Horizontal rule
        if line.strip() == '---' or line.strip() == '***':
            blocks.append(('hr', None))
            i += 1
            continue

        # Blockquote
        if line.startswith('> '):
            blocks.append(('blockquote', line[2:]))
            i += 1
            continue

        # Bullet list
        if re.match(r'^[\s]*[-*+]\s', line):
            text = re.sub(r'^[\s]*[-*+]\s', '', line)
            blocks.append(('bullet', text))
            i += 1
            continue

        # Numbered list
        if re.match(r'^[\s]*\d+\.\s', line):
            text = re.sub(r'^[\s]*\d+\.\s', '', line)
            blocks.append(('bullet', text))
            i += 1
            continue

        # Bold line (subsection header in list items)
        if line.startswith('**') and line.endswith('**'):
            blocks.append(('bold_line', line.strip('*')))
            i += 1
            continue

        # Regular paragraph
        blocks.append(('para', line))
        i += 1

    return blocks


def generate_pdf(src_path, out_path):
    pdf = MarkdownPDF()
    pdf.add_page()
    blocks = parse_markdown(src_path)

    for block_type, content in blocks:
        if block_type == 'h1':
            pdf.write_h1(content)
        elif block_type == 'h2':
            pdf.write_h2(content)
        elif block_type == 'h3':
            pdf.write_h3(content)
        elif block_type == 'para':
            pdf.write_para(content)
        elif block_type == 'bullet':
            pdf.write_bullet(content)
        elif block_type == 'code':
            pdf.write_code_block(content)
        elif block_type == 'table':
            pdf.write_table(content['headers'], content['rows'])
        elif block_type == 'hr':
            pdf.write_hr()
        elif block_type == 'blockquote':
            pdf.write_blockquote(content)
        elif block_type == 'bold_line':
            pdf.set_font('YaHei', 'B', 11)
            pdf.set_text_color(34, 34, 34)
            pdf.set_x(pdf.margin)
            pdf.multi_cell(pdf.w, 7, content)
            pdf.ln(2)

    pdf.output(out_path)
    print(f"PDF generated: {out_path}")
    print(f"Size: {os.path.getsize(out_path)} bytes")

if __name__ == '__main__':
    # Generate both PDFs
    generate_pdf(SRC_PATH, OUT_PATH)
    sagemro_src = os.path.join(base, "SAGEMRO-平台服务协议.md")
    sagemro_out = os.path.join(base, "SAGEMRO-平台服务协议.pdf")
    generate_pdf(sagemro_src, sagemro_out)
