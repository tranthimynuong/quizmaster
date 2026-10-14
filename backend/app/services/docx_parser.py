import os
import uuid
import logging
from typing import List, Dict, Optional

logger = logging.getLogger(__name__)

# OpenXML Namespaces
W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
M_NS = "http://schemas.openxmlformats.org/officeDocument/2006/math"
R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main"
PIC_NS = "http://schemas.openxmlformats.org/drawingml/2006/picture"
V_NS = "urn:schemas-microsoft-com:vml"

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "uploads", "questions")
os.makedirs(UPLOAD_DIR, exist_ok=True)


def omml_to_latex(element) -> str:
    """
    Recursively converts an Office Math Markup Language (OMML) XML element (<m:oMath>)
    into standard LaTeX mathematical formula syntax.
    """
    if element is None:
        return ""

    tag = element.tag.split("}")[-1] if "}" in element.tag else element.tag

    if tag in ("oMath", "oMathPara"):
        parts = [omml_to_latex(child) for child in element]
        inner = "".join(parts).strip()
        return f"${inner}$" if inner else ""

    elif tag == "f": # Fraction \frac{num}{den}
        num_node = element.find(f"{{{M_NS}}}num")
        den_node = element.find(f"{{{M_NS}}}den")
        num_str = omml_to_latex(num_node).strip() if num_node is not None else ""
        den_str = omml_to_latex(den_node).strip() if den_node is not None else ""
        return f"\\frac{{{num_str}}}{{{den_str}}}"

    elif tag == "sSup": # Superscript x^{exp}
        e_node = element.find(f"{{{M_NS}}}e")
        sup_node = element.find(f"{{{M_NS}}}sup")
        e_str = omml_to_latex(e_node).strip() if e_node is not None else ""
        sup_str = omml_to_latex(sup_node).strip() if sup_node is not None else ""
        return f"{{{e_str}}}^{{{sup_str}}}"

    elif tag == "sSub": # Subscript x_{sub}
        e_node = element.find(f"{{{M_NS}}}e")
        sub_node = element.find(f"{{{M_NS}}}sub")
        e_str = omml_to_latex(e_node).strip() if e_node is not None else ""
        sub_str = omml_to_latex(sub_node).strip() if sub_node is not None else ""
        return f"{{{e_str}}}_{{{sub_str}}}"

    elif tag == "sSubSup": # Subscript and Superscript x_{sub}^{sup}
        e_node = element.find(f"{{{M_NS}}}e")
        sub_node = element.find(f"{{{M_NS}}}sub")
        sup_node = element.find(f"{{{M_NS}}}sup")
        e_str = omml_to_latex(e_node).strip() if e_node is not None else ""
        sub_str = omml_to_latex(sub_node).strip() if sub_node is not None else ""
        sup_str = omml_to_latex(sup_node).strip() if sup_node is not None else ""
        return f"{{{e_str}}}_{{{sub_str}}}^{{{sup_str}}}"

    elif tag == "rad": # Radical \sqrt[deg]{rad}
        deg_node = element.find(f"{{{M_NS}}}deg")
        e_node = element.find(f"{{{M_NS}}}e")
        deg_str = omml_to_latex(deg_node).strip() if deg_node is not None else ""
        e_str = omml_to_latex(e_node).strip() if e_node is not None else ""
        if deg_str:
            return f"\\sqrt[{deg_str}]{{{e_str}}}"
        return f"\\sqrt{{{e_str}}}"

    elif tag == "d": # Delimiters (brackets, parentheses)
        dPr = element.find(f"{{{M_NS}}}dPr")
        beg_chr = "("
        end_chr = ")"
        if dPr is not None:
            beg_node = dPr.find(f"{{{M_NS}}}begChr")
            end_node = dPr.find(f"{{{M_NS}}}endChr")
            if beg_node is not None:
                beg_chr = beg_node.attrib.get(f"{{{M_NS}}}val", "(")
            if end_node is not None:
                end_chr = end_node.attrib.get(f"{{{M_NS}}}val", ")")
        e_node = element.find(f"{{{M_NS}}}e")
        e_str = omml_to_latex(e_node).strip() if e_node is not None else ""
        # Escape curly braces for LaTeX if necessary
        beg_esc = "\\{" if beg_chr == "{" else beg_chr
        end_esc = "\\}" if end_chr == "}" else end_chr
        return f"\\left{beg_esc} {e_str} \\right{end_esc}"

    elif tag == "t": # Math text
        txt = element.text or ""
        # Clean common math operators
        txt = txt.replace(" ", " ")
        return txt

    else:
        # Default recursive traversal
        return "".join(omml_to_latex(child) for child in element)


def extract_rich_text_from_docx(docx_bytes: bytes) -> str:
    """
    Extracts structured text from a Microsoft Word (.docx) document.
    Detects and preserves:
    1. Office Math (OMML) converted to standard LaTeX ($...$).
    2. Bold, Underline, and Highlight styles.
    3. Red / Green font colors (indicator for correct answers in exam keys).
    4. Embedded illustrations and diagrams (saved to /uploads/questions/).
    5. Tables and paragraph breaks.
    """
    try:
        with zipfile.ZipFile(io.BytesIO(docx_bytes)) as z:
            namelist = z.namelist()
            if "word/document.xml" not in namelist:
                return ""
            xml_data = z.read("word/document.xml")

            # Read relationships to map rId -> media/imageX.png
            rels_map = {}
            if "word/_rels/document.xml.rels" in namelist:
                try:
                    rels_xml = z.read("word/_rels/document.xml.rels")
                    rels_root = ET.fromstring(rels_xml)
                    for rel in rels_root:
                        r_id = rel.attrib.get("Id")
                        target = rel.attrib.get("Target", "")
                        if r_id and "media/" in target:
                            # Normalize path inside zip
                            media_path = "word/" + target.lstrip("/") if not target.startswith("word/") else target
                            rels_map[r_id] = media_path
                except Exception as ex:
                    logger.warning(f"Error parsing .docx rels: {ex}")

            # Extract and save images from word/media/
            saved_images_map = {}
            for r_id, media_path in rels_map.items():
                if media_path in namelist:
                    try:
                        img_bytes = z.read(media_path)
                        # Filter out tiny icon images (< 800 bytes)
                        if len(img_bytes) > 800:
                            ext = os.path.splitext(media_path)[1].lower() or ".png"
                            unique_name = f"doc_{uuid.uuid4().hex[:12]}{ext}"
                            file_path = os.path.join(UPLOAD_DIR, unique_name)
                            with open(file_path, "wb") as f_out:
                                f_out.write(img_bytes)
                            saved_images_map[r_id] = f"/uploads/questions/{unique_name}"
                    except Exception as img_err:
                        logger.warning(f"Failed to extract image {media_path}: {img_err}")

        root = ET.fromstring(xml_data)
        lines = []

        # Iterate through paragraphs and tables in order
        for body in root.findall(f"{{{W_NS}}}body"):
            for child in body:
                tag = child.tag.split("}")[-1] if "}" in child.tag else child.tag

                if tag == "p": # Paragraph
                    p_text = _extract_paragraph_text(child, saved_images_map)
                    if p_text.strip():
                        lines.append(p_text.strip())

                elif tag == "tbl": # Table
                    for row in child.findall(f"{{{W_NS}}}tr"):
                        row_cells = []
                        for cell in row.findall(f"{{{W_NS}}}tc"):
                            cell_parts = []
                            for p in cell.findall(f"{{{W_NS}}}p"):
                                pt = _extract_paragraph_text(p, saved_images_map)
                                if pt.strip():
                                    cell_parts.append(pt.strip())
                            row_cells.append(" ".join(cell_parts))
                        if any(c for c in row_cells):
                            lines.append(" | ".join(row_cells))

        return "\n".join(lines)
    except Exception as e:
        logger.error(f"Error parsing .docx file: {e}", exc_info=True)
        return ""


def _extract_paragraph_text(p_node, saved_images_map: Optional[Dict[str, str]] = None) -> str:
    """Extracts text from a paragraph node with styling markers, OMML math, and drawings."""
    if saved_images_map is None:
        saved_images_map = {}

    parts = []

    for child in p_node:
        child_tag = child.tag.split("}")[-1] if "}" in child.tag else child.tag

        # 1. Office Math Equation
        if child_tag in ("oMath", "oMathPara"):
            math_latex = omml_to_latex(child)
            if math_latex:
                parts.append(f" {math_latex} ")

        # 2. Drawings / Pictures
        elif child_tag in ("drawing", "pict"):
            img_url = _find_image_in_node(child, saved_images_map)
            if img_url:
                parts.append(f"\n[IMAGE_URL: {img_url}]\n")

        # 3. Regular Run
        elif child_tag == "r":
            # Check for embedded drawing inside run
            inner_drawing = child.find(f"{{{W_NS}}}drawing") or child.find(f"{{{W_NS}}}pict")
            if inner_drawing is not None:
                img_url = _find_image_in_node(inner_drawing, saved_images_map)
                if img_url:
                    parts.append(f"\n[IMAGE_URL: {img_url}]\n")

            # Check for math inside run
            inner_math = child.find(f"{{{M_NS}}}oMath")
            if inner_math is not None:
                math_latex = omml_to_latex(inner_math)
                if math_latex:
                    parts.append(f" {math_latex} ")

            t_nodes = child.findall(f"{{{W_NS}}}t")
            if not t_nodes:
                continue

            raw_text = "".join(t.text or "" for t in t_nodes)
            if not raw_text:
                continue

            # Check properties (bold, underline, color, highlight)
            rPr = child.find(f"{{{W_NS}}}rPr")
            is_bold = False
            is_underlined = False
            is_colored = False
            is_highlighted = False

            if rPr is not None:
                b_tag = rPr.find(f"{{{W_NS}}}b")
                if b_tag is not None:
                    val = b_tag.attrib.get(f"{{{W_NS}}}val", "true")
                    if val not in ("false", "0", "off"):
                        is_bold = True

                u_tag = rPr.find(f"{{{W_NS}}}u")
                if u_tag is not None:
                    u_val = u_tag.attrib.get(f"{{{W_NS}}}val", "single")
                    if u_val not in ("none", "false", "0"):
                        is_underlined = True

                hl_tag = rPr.find(f"{{{W_NS}}}highlight")
                if hl_tag is not None:
                    hl_val = hl_tag.attrib.get(f"{{{W_NS}}}val", "none").lower()
                    if hl_val not in ("none", "false"):
                        is_highlighted = True

                color_tag = rPr.find(f"{{{W_NS}}}color")
                if color_tag is not None:
                    c_val = color_tag.attrib.get(f"{{{W_NS}}}val", "").upper()
                    if c_val and c_val != "AUTO" and c_val != "000000":
                        if any(c_val.startswith(p) for p in ["FF", "E0", "C0", "D0", "9900", "00B", "008", "007"]):
                            is_colored = True

            marker = ""
            if is_colored or is_highlighted or is_underlined:
                marker = " [COLOR_MARK]"
            elif is_bold:
                marker = " [BOLD_MARK]"

            parts.append(f"{raw_text}{marker}")

    return "".join(parts)


def _find_image_in_node(node, saved_images_map: Dict[str, str]) -> Optional[str]:
    """Finds image relationship ID within a drawing/pict element and returns its URL."""
    if not saved_images_map:
        return None
    for desc in node.iter():
        for attr_name, attr_val in desc.attrib.items():
            if attr_name.endswith("embed") or attr_name.endswith("id"):
                if attr_val in saved_images_map:
                    return saved_images_map[attr_val]
    return None
