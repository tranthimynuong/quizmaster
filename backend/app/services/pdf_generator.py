import io
import os
import re
from typing import List, Optional
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    KeepTogether,
    HRFlowable
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# Register TrueType fonts with Vietnamese support
font_regular = "Helvetica"
font_bold = "Helvetica-Bold"
font_italic = "Helvetica-Oblique"

candidate_fonts = [
    # Windows Arial
    ("Arial", "Arial-Bold", "Arial-Italic", "C:/Windows/Fonts/arial.ttf", "C:/Windows/Fonts/arialbd.ttf", "C:/Windows/Fonts/ariali.ttf"),
    # Linux DejaVu Sans
    ("DejaVuSans", "DejaVuSans-Bold", "DejaVuSans-Oblique", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf"),
    # Linux Liberation Sans
    ("LiberationSans", "LiberationSans-Bold", "LiberationSans-Italic", "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf", "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf", "/usr/share/fonts/truetype/liberation/LiberationSans-Italic.ttf"),
    # Alpine / standard linux font paths
    ("FreeSans", "FreeSans-Bold", "FreeSans-Oblique", "/usr/share/fonts/freefont/FreeSans.ttf", "/usr/share/fonts/freefont/FreeSansBold.ttf", "/usr/share/fonts/freefont/FreeSansOblique.ttf"),
]

for reg_name, bold_name, italic_name, reg_path, bold_path, italic_path in candidate_fonts:
    if os.path.exists(reg_path):
        try:
            pdfmetrics.registerFont(TTFont(reg_name, reg_path))
            b_path = bold_path if os.path.exists(bold_path) else reg_path
            i_path = italic_path if os.path.exists(italic_path) else reg_path
            pdfmetrics.registerFont(TTFont(bold_name, b_path))
            pdfmetrics.registerFont(TTFont(italic_name, i_path))
            font_regular = reg_name
            font_bold = bold_name
            font_italic = italic_name
            break
        except Exception:
            continue



def build_quiz_pdf(
    quiz_title: str,
    share_code: str,
    questions: List[dict],
    school_name: str = "ĐỀ THI TRẮC NGHIỆM CHUẨN",
    exam_duration: str = "45 phút",
    chapter_name: Optional[str] = None,
    include_answers: str = "bottom_table",  # 'bottom_table', 'highlight', 'none'
    include_explanations: bool = False,
    two_column_options: bool = True
) -> bytes:
    """Generate a high-quality, vector A4 PDF of the quiz with ReportLab."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        'QuizTitle',
        parent=styles['Normal'],
        fontName=font_bold,
        fontSize=13,
        leading=16,
        alignment=0, # Left
        textColor=colors.HexColor("#1e1b4b")
    )

    header_left_style = ParagraphStyle(
        'HeaderLeft',
        parent=styles['Normal'],
        fontName=font_bold,
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#4b5563")
    )

    header_right_style = ParagraphStyle(
        'HeaderRight',
        parent=styles['Normal'],
        fontName=font_regular,
        fontSize=8.5,
        leading=11,
        alignment=2, # Right
        textColor=colors.HexColor("#374151")
    )

    q_title_style = ParagraphStyle(
        'QuestionTitle',
        parent=styles['Normal'],
        fontName=font_bold,
        fontSize=9.5,
        leading=13,
        textColor=colors.HexColor("#111827"),
        spaceAfter=3
    )

    opt_style = ParagraphStyle(
        'OptionText',
        parent=styles['Normal'],
        fontName=font_regular,
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#1f2937")
    )

    opt_correct_style = ParagraphStyle(
        'OptionCorrectText',
        parent=styles['Normal'],
        fontName=font_bold,
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#047857") # Emerald
    )

    explain_style = ParagraphStyle(
        'ExplanationText',
        parent=styles['Normal'],
        fontName=font_italic,
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#4b5563")
    )

    story = []

    # 1. Header Table
    left_p = [
        Paragraph(school_name.upper(), header_left_style),
        Paragraph(quiz_title.upper(), title_style),
    ]
    if chapter_name and chapter_name != 'all':
        left_p.append(Paragraph(f"Chuyên đề: <i>{chapter_name}</i>", ParagraphStyle('ChSub', parent=header_left_style, fontName=font_italic, fontSize=8.5, textColor=colors.HexColor("#059669"))))

    right_p = [
        Paragraph(f"<b>Mã đề:</b> {share_code}", header_right_style),
        Paragraph(f"<b>Thời gian:</b> {exam_duration}", header_right_style),
        Paragraph(f"<b>Số câu hỏi:</b> {len(questions)} câu", header_right_style),
    ]

    header_table = Table(
        [[left_p, right_p]],
        colWidths=[330, 190]
    )
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 6))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#111827"), spaceAfter=10))

    # 2. Questions
    for idx, q in enumerate(questions):
        correct = (q.get("correct_answer") or "A").upper().strip()
        q_content = q.get("content", "").strip()

        q_flowables = []
        q_flowables.append(Paragraph(f"<b>Câu {idx + 1}:</b> {q_content}", q_title_style))

        # Options A, B, C, D
        opts = [
            ("A", q.get("option_a", "")),
            ("B", q.get("option_b", "")),
            ("C", q.get("option_c", "")),
            ("D", q.get("option_d", "")),
        ]

        if two_column_options:
            # 2 columns layout
            row1_a = Paragraph(f"<b>A.</b> {opts[0][1]}", opt_correct_style if (include_answers == 'highlight' and correct == 'A') else opt_style)
            row1_b = Paragraph(f"<b>B.</b> {opts[1][1]}", opt_correct_style if (include_answers == 'highlight' and correct == 'B') else opt_style)
            row2_c = Paragraph(f"<b>C.</b> {opts[2][1]}", opt_correct_style if (include_answers == 'highlight' and correct == 'C') else opt_style)
            row2_d = Paragraph(f"<b>D.</b> {opts[3][1]}", opt_correct_style if (include_answers == 'highlight' and correct == 'D') else opt_style)

            opts_table = Table(
                [[row1_a, row1_b], [row2_c, row2_d]],
                colWidths=[260, 260]
            )
            opts_table.setStyle(TableStyle([
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('LEFTPADDING', (0, 0), (-1, -1), 10),
                ('RIGHTPADDING', (0, 0), (-1, -1), 4),
                ('TOPPADDING', (0, 0), (-1, -1), 1),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
            ]))
            q_flowables.append(opts_table)
        else:
            # 1 column vertical layout
            for letter, opt_text in opts:
                is_c = (include_answers == 'highlight' and correct == letter)
                p = Paragraph(f"<b>{letter}.</b> {opt_text}", opt_correct_style if is_c else opt_style)
                q_flowables.append(p)

        if include_explanations:
            expl_text = q.get(f"explanation_{correct.lower()}") or q.get("explanation_a") or "Đáp án đúng theo chuẩn lý thuyết."
            q_flowables.append(Spacer(1, 2))
            expl_box = Table(
                [[Paragraph(f"<b>Giải thích:</b> {expl_text}", explain_style)]],
                colWidths=[510]
            )
            expl_box.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#f3f4f6")),
                ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor("#d1d5db")),
                ('TOPPADDING', (0, 0), (-1, -1), 3),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
                ('LEFTPADDING', (0, 0), (-1, -1), 6),
                ('RIGHTPADDING', (0, 0), (-1, -1), 6),
            ]))
            q_flowables.append(expl_box)

        q_flowables.append(Spacer(1, 7))
        story.append(KeepTogether(q_flowables))

    # 3. Answer Key Table (Bottom Table)
    if include_answers == "bottom_table" and len(questions) > 0:
        story.append(Spacer(1, 10))
        story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#9ca3af"), spaceAfter=8))
        story.append(Paragraph("<b>BẢNG ĐÁP ÁN ĐỀ THI</b>", ParagraphStyle('AnsKeyTitle', parent=styles['Normal'], fontName=font_bold, fontSize=10.5, alignment=1, textColor=colors.HexColor("#1e1b4b"), spaceAfter=6)))

        # Build 10 columns per row table
        num_cols = 10
        table_rows = []
        
        for chunk_idx in range(0, len(questions), num_cols):
            chunk = questions[chunk_idx:chunk_idx + num_cols]
            
            # Row 1: Question numbers
            num_row = [Paragraph(f"<b>{chunk_idx + i + 1}</b>", ParagraphStyle('ColNum', fontName=font_bold, fontSize=8, alignment=1, textColor=colors.HexColor("#1e293b"))) for i in range(len(chunk))]
            # Row 2: Answers
            ans_row = [Paragraph(f"<b>{(q.get('correct_answer') or 'A').upper()}</b>", ParagraphStyle('ColAns', fontName=font_bold, fontSize=8.5, alignment=1, textColor=colors.HexColor("#2563eb"))) for q in chunk]
            
            # Pad empty cells if last row has less than num_cols
            while len(num_row) < num_cols:
                num_row.append("")
                ans_row.append("")

            table_rows.append(num_row)
            table_rows.append(ans_row)

        ans_table = Table(table_rows, colWidths=[52] * num_cols)
        ans_table.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#64748b")),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('ROWBACKGROUNDS', (0, 0), (-1, -1), [colors.HexColor("#f1f5f9"), colors.HexColor("#ffffff")]),
            ('TOPPADDING', (0, 0), (-1, -1), 2.5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
        ]))
        story.append(KeepTogether([ans_table]))

    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
