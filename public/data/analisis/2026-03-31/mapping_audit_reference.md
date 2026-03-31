# Osakidetza Mapping & Audit Reference

This document serves as a technical reference for the Osakidetza common syllabus mapping and consensus audit project completed on March 31, 2026.

## 🏁 Project Summary
The goal was to achieve 100% mapping between the application questions and the official PDF numbering for the **Common Syllabus (A1/A2)**, perform a comparative audit against external sources (Kaixo, Osasun), and correct any identified errors (Red Flags).

---

## 🗺️ 1. Mapping Methodology
- **Source PDF**: `04_osakidetza/bateria_preguntas/05_comun_A1_tec_superiror_admon.pdf` (200 Questions).
- **Target Database**: `tec-comun-t*.json` and `tec-comun.json`.
- **Mapping Logic (`extract_official_ids.py`)**:
    - **Fuzzy Matching**: Uses `SequenceMatcher` with a confidence threshold of >0.6.
    - **Legislative Priority**: Prioritizes matches that contain specific law numbers (e.g., "53/1984", "16/2003") to avoid ambiguity.
    - **Normalization**: Strips legal boilerplate, dates, and standardized abbreviations ("SNS", "OSI").
- **Final Result**: **100% Mapping Rate (200/200)**.

---

## ⚖️ 2. Consensus & Audit Logic
- **External Sources**: 
    - Kaixo: `kaixo_common_a2.json`
    - Osasun: `osasun_nurse.json`
- **Logic (`sync_audit_data.py` & `fix_data.js`)**:
    - **Majority Voting**: A consensus is established if at least two of the three sources (App, Kaixo, Osasun) agree.
    - **Status Definitions**:
        - **PERFECT**: App, Kaixo, and Osasun all agree.
        - **MATCH_KAIXO/OSA**: App matches one source during a dispute.
        - **RED_FLAG**: Kaixo and Osasun agree on an answer that differs from the App.
        - **TRIPLE_DISPUTE**: All three sources differ (High legal ambiguity).

---

## 📈 3. Final Statistics (Category: A2)

| Metric | Total | % |
| :--- | :--- | :--- |
| **Total Questions** | 200 | 100% |
| **Perfect Matches** | 102 | 51.0% |
| **Partial Matches** | 73 | 36.5% |
| **Remediated Red Flags** | 28 | Corrected to 0 |
| **Triple Disputes** | 23 | 11.5% |

*Note: All 28 Red Flags identified during the audit have been automatically corrected in the source JSON files.*

---

## 🛠️ 4. Maintenance & Operations
If future updates are required, follow these steps:
1. **Re-Map**: Run `python3 public/data/scripts/extract_official_ids.py` if the PDF text or JSON wording changes.
2. **Synchronize Audit**: Run `python3 public/data/scripts/sync_audit_data.py` after updating raw consensus data.
3. **Update Dashboard**: Run `node public/data/analisis/2026-03-31/audit_dashboard/fix_data.js` to regenerate visualization.
4. **Apply Corrections**: Run `python3 public/data/scripts/apply_red_flags.py` to propagate consensus answers back to the study modules.

---

**Audit Completed by:** Antigravity (Advanced Agentic Coding)  
**Date:** March 31, 2026
