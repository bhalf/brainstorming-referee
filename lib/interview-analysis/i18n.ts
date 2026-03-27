'use client';

import { createContext, useContext, useState, useEffect, useCallback, createElement, type ReactNode } from 'react';

export type IALang = 'de' | 'en';

// ─── Context ────────────────────────────────────────────────────────────────

export const IALanguageContext = createContext<IALang>('de');
const IALanguageSetterContext = createContext<(lang: IALang) => void>(() => {});

export function useIALang(): IALang {
  return useContext(IALanguageContext);
}

export function useSetIALang(): (lang: IALang) => void {
  return useContext(IALanguageSetterContext);
}

// ─── Provider (reads/writes localStorage) ───────────────────────────────────

const STORAGE_KEY = 'ia_ui_lang';

export function IALanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<IALang>('de');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'de') setLangState(stored);
    setMounted(true);
  }, []);

  const setLang = useCallback((l: IALang) => {
    setLangState(l);
    localStorage.setItem(STORAGE_KEY, l);
  }, []);

  // Avoid hydration mismatch — render with default until mounted
  const value = mounted ? lang : 'de';

  return createElement(
    IALanguageContext.Provider,
    { value },
    createElement(IALanguageSetterContext.Provider, { value: setLang }, children)
  );
}

// ─── Translation helper ─────────────────────────────────────────────────────

export function t(key: string, lang: IALang): string {
  return labels[lang]?.[key] ?? labels.de[key] ?? key;
}

// ─── Labels ─────────────────────────────────────────────────────────────────

const labels: Record<IALang, Record<string, string>> = {
  de: {
    // General
    back: 'Zurück',
    cancel: 'Abbrechen',
    save: 'Speichern',
    delete: 'Löschen',
    edit: 'Bearbeiten',
    close: 'Schliessen',
    loading: 'Laden...',
    error: 'Fehler',
    connection_failed: 'Verbindungsfehler',
    words: 'Wörter',
    interviews: 'Interviews',
    questions: 'Fragen',
    answers: 'Antworten',
    no_answer: 'Keine Antwort',
    unknown: 'Unbekannt',
    total: 'gesamt',

    // Sentiment
    positive: 'Positiv',
    negative: 'Negativ',
    neutral: 'Neutral',
    ambivalent: 'Gemischt',
    sentiment: 'Sentiment',

    // Confidence / Match Type
    match_direct: 'Direkt',
    match_paraphrased: 'Umformuliert',
    match_implicit: 'Implizit',
    match_scattered: 'Verstreut',
    original_question: 'Gestellte Frage',
    show_more: 'Mehr anzeigen',
    show_less: 'Weniger anzeigen',
    follow_up: 'Nachfrage',

    // Tabs
    tab_upload: 'Upload',
    tab_guide: 'Leitfaden',
    tab_matrix: 'Fragenmatrix',
    tab_heatmap: 'Heatmap',
    tab_comparison: 'Vergleich',
    tab_dashboard: 'Dashboard',
    tab_chat: 'Chat',

    // Pipeline
    pipeline_title: 'Analyse-Pipeline',
    pipeline_desc_guide: 'Leitfaden-basierte Antwort-Zuordnung',
    pipeline_desc_no_guide: 'KI-gestützte Fragen-Erkennung und Antwort-Zuordnung',
    pipeline_guide_questions: 'Leitfaden-Fragen',
    pipeline_full_rebuild: 'Komplett neu',
    pipeline_start: 'Analyse starten',
    pipeline_running: 'Pipeline läuft...',
    pipeline_all_done: 'Alle analysiert',
    pipeline_new_interviews: 'neue(s) Interview(s) analysieren',
    pipeline_incremental_done: 'Inkrementell: Neue Interviews analysiert — bestehende Daten beibehalten',
    pipeline_full_done: 'Komplett neu aufgebaut',
    step_transcribed: 'Transkribiert',
    step_guide_created: 'Leitfaden-Fragen erstellt',
    step_questions_extracted: 'Fragen extrahiert',
    step_questions_matched: 'Fragen gematcht',
    step_answers_segmented: 'Antworten zugeordnet',
    pipeline_full_rebuild_title: 'Alle Daten löschen und Pipeline komplett neu ausführen',

    // Upload
    upload_add: 'Hinzufügen',
    upload_audio: 'Audio hochladen',
    upload_transcript: 'Transkript einfügen',
    upload_empty_title: 'Noch keine Interviews',
    upload_empty_desc: 'Lade Audio-Dateien hoch oder füge Transkripte manuell ein.',
    upload_uploaded: 'hochgeladen',
    upload_delete_confirm: 'Interview wirklich löschen?',
    status_pending: 'Ausstehend',
    status_transcribing: 'Transkribiert...',
    status_transcribed: 'Transkribiert',
    status_analyzed: 'Analysiert',

    // Audio Uploader
    audio_name: 'Interview-Name',
    audio_name_placeholder: 'z.B. Teilnehmer:in 01',
    audio_splitting: 'Datei wird in Teile aufgeteilt...',
    audio_transcribing_part: 'Transkribiere Teil',
    audio_failed: 'Upload fehlgeschlagen',
    audio_done: 'Fertig!',
    audio_transcribing: 'Transkribiere...',
    audio_drop: 'Audio-/Videodatei hierher ziehen oder durchsuchen',
    audio_formats: 'MP3, WAV, M4A, MP4, MOV — Videos werden automatisch konvertiert',
    audio_start: 'Hochladen & Transkribieren',
    audio_extracting_video: 'Extrahiere Audio aus Video...',
    audio_click_change: 'Klicken um zu ändern',

    // Transcript Uploader
    transcript_name: 'Interview-Name',
    transcript_name_placeholder: 'z.B. Teilnehmer:in 01',
    transcript_label: 'Transkript',
    transcript_load_file: 'Datei laden (.docx, .txt, .srt)',
    transcript_docx_info: 'Word-Dokument wird serverseitig geparst',
    transcript_change: 'Ändern',
    transcript_placeholder: 'Transkript hier einfügen oder eine Datei laden...',
    transcript_upload_failed: 'Upload fehlgeschlagen',
    transcript_save_failed: 'Speichern fehlgeschlagen',
    transcript_uploading: 'Lade hoch & parse...',
    transcript_saving: 'Speichere...',
    transcript_save: 'Interview speichern',

    // Guide Editor
    guide_title: 'Interview-Leitfaden',
    guide_placeholder: 'Füge deinen Leitfaden hier ein. Die KI erkennt automatisch Fragen und Kategorien...',
    guide_text_label: 'Leitfaden-Text',
    guide_questions_found: 'Fragen erkannt',
    guide_analyzing: 'KI analysiert Leitfaden...',
    guide_reparse: 'Neu parsen',
    guide_parse: 'Leitfaden analysieren',
    guide_delete_confirm: 'Ja, löschen',
    guide_parse_failed: 'Parsen fehlgeschlagen',
    guide_delete_failed: 'Löschen fehlgeschlagen',
    guide_default_topic: 'Allgemein',

    // Matrix View
    matrix_search_placeholder: 'Suche in Antworten...',
    matrix_reset: 'Zurücksetzen',
    matrix_empty_title: 'Noch keine Analyseergebnisse',
    matrix_empty_desc: 'Starte die Analyse-Pipeline oben, um die Fragenmatrix zu füllen.',
    matrix_mapped_questions: 'Zugeordnete Fragen',
    matrix_select_target: 'Ziel wählen...',
    matrix_move: 'Verschieben',
    matrix_move_tooltip: 'Zu anderer Frage verschieben',
    matrix_merge_with: 'Zusammenführen mit...',
    matrix_merge_button: 'Mit anderer Frage zusammenführen...',
    matrix_summary_title: 'KI-Zusammenfassung',
    matrix_summary_regenerate: 'Neu generieren',
    matrix_summary_generating: 'Generiere Zusammenfassung...',
    matrix_summary_generate: 'Zusammenfassung generieren',
    badge_guide: 'Leitfaden',
    badge_additional: 'Zusatzfrage',
    matrix_mappings_count: 'Zuordnungen',

    // Chat View
    chat_title: 'Frag deine Daten',
    chat_based_on: 'Basierend auf',
    chat_clear: 'Chat löschen',
    chat_error: 'Unbekannter Fehler',
    chat_placeholder: 'Stelle eine Frage zu deinen Interview-Daten...',
    chat_hint: 'Enter = Senden, Shift+Enter = Neue Zeile',
    chat_desc_prefix: 'Die KI analysiert alle',
    chat_desc_suffix: 'segmentierten Antworten und antwortet mit Zitaten.',
    chat_you: 'Du',
    chat_assistant: 'Assistent',
    chat_analyzing: 'Analysiert...',
    chat_suggestion_1: 'Fasse die wichtigsten Erkenntnisse aus allen Interviews zusammen.',
    chat_suggestion_2: 'Gibt es Widersprüche zwischen den Befragten?',
    chat_suggestion_3: 'Welche Themen wurden am kontroversesten bewertet?',
    chat_suggestion_4: 'Bei welchen Fragen sind sich die Befragten einig?',

    // Dashboard
    dashboard_words_avg: 'Wörter (Ø)',
    dashboard_sentiment_dist: 'Sentiment-Verteilung',
    dashboard_over_all: 'Über alle',
    dashboard_coverage_title: 'Abdeckung pro Frage',
    dashboard_coverage_desc: 'Wie viele Interviews jede Frage beantworten',
    dashboard_sentiment_q: 'Sentiment pro Frage',
    dashboard_sentiment_q_desc: 'Stimmungsverteilung je Frage',
    dashboard_lengths: 'Interview-Längen',
    dashboard_lengths_desc: 'Wortanzahl pro Interview',

    // Heatmap
    heatmap_empty: 'Noch keine analysierten Daten vorhanden.',
    heatmap_total_coverage: 'Gesamtabdeckung',
    heatmap_cells_filled: 'Zellen belegt',
    heatmap_color: 'Farbe:',
    heatmap_coverage: 'Abdeckung',
    heatmap_wordcount: 'Wortanzahl',
    heatmap_question: 'FRAGE',
    heatmap_coverage_label: 'ABDECKUNG',
    heatmap_gap_title: 'Lückenanalyse',
    heatmap_gap_questions: 'Fragen mit fehlenden Antworten',
    heatmap_gap_interviews: 'Interviews mit Lücken',
    heatmap_answered: 'Beantwortet',
    heatmap_not_answered: 'Nicht beantwortet',
    heatmap_few: 'Wenig',
    heatmap_many: 'Viel',

    // Comparison
    comparison_min2: 'Mindestens 2 analysierte Interviews nötig für einen Vergleich.',
    comparison_a: 'INTERVIEW A',
    comparison_b: 'INTERVIEW B',
    comparison_swap: 'Interviews tauschen',
    comparison_only_diff: 'Nur Unterschiede',
    comparison_select_different: 'Bitte wähle zwei verschiedene Interviews aus.',
    comparison_no_diff: 'Keine Unterschiede im Sentiment gefunden.',
    comparison_coverage: 'Abdeckung',
    comparison_less: 'Weniger',

    // Project list page
    project_title: 'Interview-Analyse',
    project_subtitle: 'Qualitative Auswertung semi-strukturierter Interviews',
    project_new: 'Neues Projekt',
    project_new_dialog: 'Neues Projekt erstellen',
    project_name: 'Projektname',
    project_name_placeholder: 'z.B. Studie Arbeitszufriedenheit 2026',
    project_description: 'Beschreibung',
    project_desc_placeholder: 'Kurze Beschreibung des Forschungsprojekts (optional)',
    project_language: 'Sprache',
    project_language_de: 'Deutsch',
    project_language_en: 'Englisch',
    project_creating: 'Erstelle...',
    project_create: 'Projekt erstellen',
    project_empty_title: 'Noch keine Projekte vorhanden',
    project_empty_desc: 'Erstelle ein neues Projekt um mit der Analyse zu beginnen.',
    project_delete_confirm: 'Projekt wirklich löschen? Alle Interviews und Analysen gehen verloren.',
    project_interview_singular: 'Interview',

    // Password Gate
    pw_title: 'Interview-Analyse',
    pw_subtitle: 'Geschützter Bereich',
    pw_label: 'Passwort',
    pw_placeholder: 'Zugangspasswort eingeben',
    pw_checking: 'Prüfe...',
    pw_submit: 'Zugang',
    pw_wrong: 'Falsches Passwort',
    pw_error: 'Verbindungsfehler',
  },
  en: {
    // General
    back: 'Back',
    cancel: 'Cancel',
    save: 'Save',
    delete: 'Delete',
    edit: 'Edit',
    close: 'Close',
    loading: 'Loading...',
    error: 'Error',
    connection_failed: 'Connection failed',
    words: 'Words',
    interviews: 'Interviews',
    questions: 'Questions',
    answers: 'Answers',
    no_answer: 'No answer',
    unknown: 'Unknown',
    total: 'total',

    // Sentiment
    positive: 'Positive',
    negative: 'Negative',
    neutral: 'Neutral',
    ambivalent: 'Mixed',
    sentiment: 'Sentiment',

    // Confidence / Match Type
    match_direct: 'Direct',
    match_paraphrased: 'Paraphrased',
    match_implicit: 'Implicit',
    match_scattered: 'Scattered',
    original_question: 'Asked question',
    show_more: 'Show more',
    show_less: 'Show less',
    follow_up: 'Follow-up',

    // Tabs
    tab_upload: 'Upload',
    tab_guide: 'Interview Guide',
    tab_matrix: 'Question Matrix',
    tab_heatmap: 'Heatmap',
    tab_comparison: 'Comparison',
    tab_dashboard: 'Dashboard',
    tab_chat: 'Chat',

    // Pipeline
    pipeline_title: 'Analysis Pipeline',
    pipeline_desc_guide: 'Guide-based answer mapping',
    pipeline_desc_no_guide: 'AI-powered question extraction and answer mapping',
    pipeline_guide_questions: 'Guide Questions',
    pipeline_full_rebuild: 'Full rebuild',
    pipeline_start: 'Start analysis',
    pipeline_running: 'Pipeline running...',
    pipeline_all_done: 'All analyzed',
    pipeline_new_interviews: 'new interview(s) to analyze',
    pipeline_incremental_done: 'Incremental: New interviews analyzed — existing data preserved',
    pipeline_full_done: 'Fully rebuilt',
    step_transcribed: 'Transcribed',
    step_guide_created: 'Guide questions created',
    step_questions_extracted: 'Questions extracted',
    step_questions_matched: 'Questions matched',
    step_answers_segmented: 'Answers mapped',
    pipeline_full_rebuild_title: 'Delete all data and rebuild the pipeline from scratch',

    // Upload
    upload_add: 'Add',
    upload_audio: 'Upload audio',
    upload_transcript: 'Paste transcript',
    upload_empty_title: 'No interviews yet',
    upload_empty_desc: 'Upload audio files or paste transcripts manually.',
    upload_uploaded: 'uploaded',
    upload_delete_confirm: 'Delete this interview?',
    status_pending: 'Pending',
    status_transcribing: 'Transcribing...',
    status_transcribed: 'Transcribed',
    status_analyzed: 'Analyzed',

    // Audio Uploader
    audio_name: 'Interview Name',
    audio_name_placeholder: 'e.g. Participant 01',
    audio_splitting: 'Splitting file into chunks...',
    audio_transcribing_part: 'Transcribing part',
    audio_failed: 'Upload failed',
    audio_done: 'Done!',
    audio_transcribing: 'Transcribing...',
    audio_drop: 'Drop audio/video file here or browse',
    audio_formats: 'MP3, WAV, M4A, MP4, MOV — Videos are converted automatically',
    audio_start: 'Upload & Transcribe',
    audio_extracting_video: 'Extracting audio from video...',
    audio_click_change: 'Click to change',

    // Transcript Uploader
    transcript_name: 'Interview Name',
    transcript_name_placeholder: 'e.g. Participant 01',
    transcript_label: 'Transcript',
    transcript_load_file: 'Load file (.docx, .txt, .srt)',
    transcript_docx_info: 'Word document parsed server-side',
    transcript_change: 'Change',
    transcript_placeholder: 'Paste transcript here or load a file...',
    transcript_upload_failed: 'Upload failed',
    transcript_save_failed: 'Save failed',
    transcript_uploading: 'Uploading & parsing...',
    transcript_saving: 'Saving...',
    transcript_save: 'Save interview',

    // Guide Editor
    guide_title: 'Interview Guide',
    guide_placeholder: 'Paste your interview guide here. The AI will automatically detect questions and categories...',
    guide_text_label: 'Guide Text',
    guide_questions_found: 'questions detected',
    guide_analyzing: 'AI analyzing guide...',
    guide_reparse: 'Re-parse',
    guide_parse: 'Analyze guide',
    guide_delete_confirm: 'Yes, delete',
    guide_parse_failed: 'Parsing failed',
    guide_delete_failed: 'Delete failed',
    guide_default_topic: 'General',

    // Matrix View
    matrix_search_placeholder: 'Search in answers...',
    matrix_reset: 'Reset',
    matrix_empty_title: 'No analysis results yet',
    matrix_empty_desc: 'Start the analysis pipeline above to populate the question matrix.',
    matrix_mapped_questions: 'Mapped Questions',
    matrix_select_target: 'Select target...',
    matrix_move: 'Move',
    matrix_move_tooltip: 'Move to another question',
    matrix_merge_with: 'Merge with...',
    matrix_merge_button: 'Merge with another question...',
    matrix_summary_title: 'AI Summary',
    matrix_summary_regenerate: 'Regenerate',
    matrix_summary_generating: 'Generating summary...',
    matrix_summary_generate: 'Generate summary',
    badge_guide: 'Guide',
    badge_additional: 'Additional',
    matrix_mappings_count: 'mappings',

    // Chat View
    chat_title: 'Ask your data',
    chat_based_on: 'Based on',
    chat_clear: 'Clear chat',
    chat_error: 'Unknown error',
    chat_placeholder: 'Ask a question about your interview data...',
    chat_hint: 'Enter = Send, Shift+Enter = New line',
    chat_desc_prefix: 'The AI analyzes all',
    chat_desc_suffix: 'segmented answers and responds with citations.',
    chat_you: 'You',
    chat_assistant: 'Assistant',
    chat_analyzing: 'Analyzing...',
    chat_suggestion_1: 'Summarize the key findings across all interviews.',
    chat_suggestion_2: 'Are there contradictions between respondents?',
    chat_suggestion_3: 'Which topics were rated most controversially?',
    chat_suggestion_4: 'On which questions do respondents agree?',

    // Dashboard
    dashboard_words_avg: 'Words (avg)',
    dashboard_sentiment_dist: 'Sentiment Distribution',
    dashboard_over_all: 'Across all',
    dashboard_coverage_title: 'Coverage per Question',
    dashboard_coverage_desc: 'How many interviews answer each question',
    dashboard_sentiment_q: 'Sentiment per Question',
    dashboard_sentiment_q_desc: 'Sentiment distribution per question',
    dashboard_lengths: 'Interview Lengths',
    dashboard_lengths_desc: 'Word count per interview',

    // Heatmap
    heatmap_empty: 'No analyzed data available yet.',
    heatmap_total_coverage: 'Total Coverage',
    heatmap_cells_filled: 'cells filled',
    heatmap_color: 'Color:',
    heatmap_coverage: 'Coverage',
    heatmap_wordcount: 'Word Count',
    heatmap_question: 'QUESTION',
    heatmap_coverage_label: 'COVERAGE',
    heatmap_gap_title: 'Gap Analysis',
    heatmap_gap_questions: 'Questions with missing answers',
    heatmap_gap_interviews: 'Interviews with gaps',
    heatmap_answered: 'Answered',
    heatmap_not_answered: 'Not answered',
    heatmap_few: 'Few',
    heatmap_many: 'Many',

    // Comparison
    comparison_min2: 'At least 2 analyzed interviews needed for comparison.',
    comparison_a: 'INTERVIEW A',
    comparison_b: 'INTERVIEW B',
    comparison_swap: 'Swap interviews',
    comparison_only_diff: 'Only differences',
    comparison_select_different: 'Please select two different interviews.',
    comparison_no_diff: 'No sentiment differences found.',
    comparison_coverage: 'Coverage',
    comparison_less: 'Less',

    // Project list page
    project_title: 'Interview Analysis',
    project_subtitle: 'Qualitative analysis of semi-structured interviews',
    project_new: 'New Project',
    project_new_dialog: 'Create New Project',
    project_name: 'Project Name',
    project_name_placeholder: 'e.g. Work Satisfaction Study 2026',
    project_description: 'Description',
    project_desc_placeholder: 'Short description of the research project (optional)',
    project_language: 'Language',
    project_language_de: 'German',
    project_language_en: 'English',
    project_creating: 'Creating...',
    project_create: 'Create Project',
    project_empty_title: 'No projects yet',
    project_empty_desc: 'Create a new project to start analyzing.',
    project_delete_confirm: 'Delete project? All interviews and analyses will be lost.',
    project_interview_singular: 'Interview',

    // Password Gate
    pw_title: 'Interview Analysis',
    pw_subtitle: 'Protected Area',
    pw_label: 'Password',
    pw_placeholder: 'Enter access password',
    pw_checking: 'Checking...',
    pw_submit: 'Access',
    pw_wrong: 'Wrong password',
    pw_error: 'Connection error',
  },
};
