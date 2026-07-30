const QUESTION_TIME_LIMIT_SECONDS = 20;
const QUESTIONS_PER_MODULE = 5;
const PASS_MARK_PERCENT = 60;

const question = (id, prompt, correct, distractors, explanation) => ({
  id,
  prompt,
  options: [correct, ...distractors],
  correctIndex: 0,
  explanation,
});

const buildModule = ({
  code,
  title,
  units,
  week,
  strand,
  duration,
  overview,
  outcomes,
  keyIdeas,
  classroomPractice,
  assessment,
}) => ({
  code,
  title,
  units,
  week,
  strand,
  duration,
  overview,
  outcomes,
  keyIdeas,
  classroomPractice,
  assessment,
});

const MODULES = [
  buildModule({
    code: "PDE 701",
    title: "History of Education",
    units: 2,
    week: 1,
    strand: "Foundations",
    duration: "35 min",
    overview:
      "Trace how indigenous African learning, missionary schooling, colonial policy, and post-independence reform shaped the purposes and structures of Nigerian education.",
    outcomes: [
      "Distinguish continuity from change across major educational eras.",
      "Connect historical policy choices to present classroom realities.",
      "Evaluate reforms within their political and cultural contexts.",
      "Avoid present-day judgments that ignore historical evidence.",
    ],
    keyIdeas: [
      {
        title: "Education before formal schooling",
        body:
          "Indigenous systems were deliberate and socially organised. Learning was embedded in family, occupation, morality, language, apprenticeship, ceremony, and community responsibility.",
      },
      {
        title: "Mission, colonial rule, and access",
        body:
          "Mission schools expanded literacy and religious instruction, while colonial grants, codes, examinations, and administrative needs influenced what counted as valuable knowledge and where schools developed.",
      },
      {
        title: "Reform as a response to inherited structures",
        body:
          "Post-independence reforms pursued national identity, wider access, relevance, technical capability, and unity, but implementation continued to reflect unequal resources and earlier institutional patterns.",
      },
    ],
    classroomPractice: [
      "Build a timeline that links one historical policy to one current school practice.",
      "Invite learners to compare apprenticeship evidence with classroom-based certification.",
      "Use local oral histories as sources, then corroborate them with documentary evidence.",
    ],
    assessment: [
      question(
        "pde701-q1",
        "A historian finds that a community taught farming, dispute resolution, ethics, and craft mastery through age groups and apprenticeship but kept no written syllabus. Which conclusion is most defensible?",
        "It had an organised educational system whose curriculum was embedded in social practice.",
        [
          "It had socialisation, but education began only when mission schools arrived.",
          "It had a curriculum only if every learner followed an identical sequence.",
          "It cannot be studied educationally because its evidence is mainly oral.",
        ],
        "A curriculum may be intentional and socially organised without being school-based or written."
      ),
      question(
        "pde701-q2",
        "Two regions still show different patterns of formal-school participation long after independence. Which historical inquiry offers the strongest explanation?",
        "Compare the timing, density, and local reception of mission and colonial schooling in both regions.",
        [
          "Compare only the intelligence-test averages of present learners.",
          "Assume national policy erased all earlier institutional differences.",
          "Treat current enrolment as proof that one culture opposed learning.",
        ],
        "Institutional path dependence is best examined through comparative historical evidence."
      ),
      question(
        "pde701-q3",
        "Which evidence would most seriously weaken the claim that colonial education was designed solely for mass intellectual emancipation?",
        "Records showing narrow access and curricula aligned with clerical manpower needs.",
        [
          "Evidence that some graduates later led nationalist movements.",
          "A textbook containing both local and foreign examples.",
          "An increase in literacy after several schools opened.",
        ],
        "Policy intent is better tested against access patterns, curriculum, and administrative purposes than later unintended outcomes."
      ),
      question(
        "pde701-q4",
        "A teacher asks learners whether a past reform 'succeeded.' What must be established first to make the judgment historically sound?",
        "The reform's stated aims, implementation conditions, affected groups, and period-specific evidence.",
        [
          "Whether the reform resembles the newest international policy.",
          "Whether one prominent graduate approved of the reform.",
          "Whether present-day teachers would personally support it.",
        ],
        "Historical evaluation requires criteria grounded in the reform's context and evidence."
      ),
      question(
        "pde701-q5",
        "Which classroom task best develops disciplined historical thinking rather than memorisation?",
        "Reconcile conflicting oral and archival accounts of why a local school was founded.",
        [
          "Recite education ordinances in chronological order.",
          "Copy a completed national education timeline.",
          "List every minister of education from a reference sheet.",
        ],
        "Corroborating conflicting sources develops sourcing, context, and evidential reasoning."
      ),
    ],
  }),
  buildModule({
    code: "PDE 702",
    title: "Developmental Psychology",
    units: 2,
    week: 1,
    strand: "Learner development",
    duration: "40 min",
    overview:
      "Use developmental evidence to interpret change in cognition, language, identity, emotion, morality, and social participation without reducing learners to rigid age labels.",
    outcomes: [
      "Separate developmental tendencies from fixed prescriptions.",
      "Identify interactions among maturation, experience, culture, and support.",
      "Select developmentally responsive scaffolds.",
      "Recognise when observation warrants referral rather than diagnosis.",
    ],
    keyIdeas: [
      {
        title: "Development is patterned, not identical",
        body:
          "Age-related patterns are useful guides, but variation within an age group is normal. Development is multidimensional, culturally situated, and influenced by opportunity and relationships.",
      },
      {
        title: "Learning within reach",
        body:
          "Effective support targets what a learner cannot yet do independently but can accomplish with prompts, modelling, tools, or collaboration, then gradually withdraws that support.",
      },
      {
        title: "Observation before inference",
        body:
          "Teachers should document behaviour across tasks, settings, and time. A classroom observation can trigger support or referral, but it is not a clinical diagnosis.",
      },
    ],
    classroomPractice: [
      "Record what support changes a learner's performance, not only what the learner gets wrong.",
      "Offer concrete representations before expecting abstraction.",
      "Use private, factual referral notes that avoid labels and blame.",
    ],
    assessment: [
      question(
        "pde702-q1",
        "A ten-year-old solves proportional problems with counters and guided questions but fails when given symbols alone. Which interpretation is best?",
        "The task lies within the learner's supported capability and calls for fading from concrete to abstract scaffolds.",
        [
          "The learner has permanently failed to develop formal reasoning.",
          "The correct response is to remove all assistance immediately.",
          "The performance proves a specific learning disorder.",
        ],
        "Supported success reveals emerging competence; it does not justify a fixed label."
      ),
      question(
        "pde702-q2",
        "Why is using a stage theory as a strict age-based checklist educationally risky?",
        "It can hide domain, cultural, experiential, and individual variation in performance.",
        [
          "Stage theories claim that development never follows patterns.",
          "Age has no statistical relationship with development.",
          "Only biological maturation influences classroom learning.",
        ],
        "Developmental patterns are probabilistic and context-sensitive, not rigid timetables."
      ),
      question(
        "pde702-q3",
        "A normally engaged learner becomes withdrawn for two days after a family disruption. What is the most responsible first response?",
        "Provide safety and routine, check in privately, document patterns, and involve the appropriate support pathway if concerns persist.",
        [
          "Diagnose depression and announce accommodations to the class.",
          "Ignore the change because emotions are outside teaching.",
          "Apply a public consequence to restore participation quickly.",
        ],
        "Teachers observe and support; they do not diagnose from brief behaviour."
      ),
      question(
        "pde702-q4",
        "Which finding most clearly demonstrates an interaction between development and context?",
        "A learner uses advanced reasoning in a familiar market task but not in an unfamiliar textbook format.",
        [
          "Every learner masters a skill on the same birthday.",
          "A reflex appears without learning or experience.",
          "Test scores remain identical across every setting.",
        ],
        "Performance can depend on familiarity, cultural tools, language, and task representation."
      ),
      question(
        "pde702-q5",
        "Which teacher action best supports adolescent identity development while maintaining academic standards?",
        "Offer meaningful choices with clear criteria and structured reflection on consequences.",
        [
          "Remove all boundaries so identity can develop without constraint.",
          "Require identical interests and viewpoints from all learners.",
          "Treat peer influence as evidence of moral failure.",
        ],
        "Autonomy develops through bounded choice, responsibility, and reflection."
      ),
    ],
  }),
  buildModule({
    code: "PDE 703",
    title: "General Principles and Methods in Education",
    units: 2,
    week: 1,
    strand: "Pedagogy",
    duration: "45 min",
    overview:
      "Align objectives, evidence, teaching methods, feedback, and learner participation so that instructional choices follow the demands of learning rather than habit.",
    outcomes: [
      "Write observable objectives at an appropriate cognitive level.",
      "Select methods from purpose, learner, and content evidence.",
      "Use checks for understanding to adapt instruction.",
      "Plan participation without confusing activity with learning.",
    ],
    keyIdeas: [
      {
        title: "Constructive alignment",
        body:
          "Objectives identify the intended performance, assessment provides evidence of that performance, and learning activities prepare learners to produce it.",
      },
      {
        title: "Method follows purpose",
        body:
          "Explanation, demonstration, inquiry, discussion, practice, and collaboration solve different instructional problems. No method is universally superior.",
      },
      {
        title: "Responsive teaching",
        body:
          "Frequent, low-stakes evidence lets a teacher reteach, regroup, extend, or change representation before misconceptions become entrenched.",
      },
    ],
    classroomPractice: [
      "Match every major activity to an explicit learning objective.",
      "Plan one hinge question whose answers determine the next teaching move.",
      "Give feedback that identifies the gap and a usable next step.",
    ],
    assessment: [
      question(
        "pde703-q1",
        "The objective is 'evaluate the credibility of two sources,' but the assessment asks learners to define credibility. What is the central design fault?",
        "The assessment samples recall rather than the evaluative performance in the objective.",
        [
          "The objective contains more than one source.",
          "Definitions can never be assessed in school.",
          "Evaluation should be taught only through lecture.",
        ],
        "Alignment requires assessment at the intended level of performance."
      ),
      question(
        "pde703-q2",
        "After a demonstration, most learners choose a distractor revealing the same misconception. Which response is most instructionally valid?",
        "Pause, diagnose the reasoning, re-represent the concept, and check again.",
        [
          "Continue because the lesson plan has a fixed pace.",
          "Record the scores and wait for the final examination.",
          "Repeat the identical explanation more loudly.",
        ],
        "Formative evidence should change the next teaching action."
      ),
      question(
        "pde703-q3",
        "When is direct instruction more defensible than minimally guided discovery?",
        "When novices need an efficient model of a complex procedure with high cognitive load.",
        [
          "Whenever the teacher wants learners to remain passive.",
          "Only when the content has no conceptual structure.",
          "When the goal is to prevent learners from practising.",
        ],
        "Explicit modelling can manage cognitive load for novices before guided independence."
      ),
      question(
        "pde703-q4",
        "A group task produces lively talk, but one learner completes all reasoning. Which redesign best preserves collaboration and accountability?",
        "Assign interdependent roles and require an individual explanation after the group product.",
        [
          "Award one mark without checking individual understanding.",
          "Increase the group size so participation becomes less visible.",
          "Remove the learning criteria to encourage creativity.",
        ],
        "Positive interdependence and individual accountability are both necessary."
      ),
      question(
        "pde703-q5",
        "Which feedback is most likely to improve a learner's next draft?",
        "Your claim is clear; connect each paragraph's evidence explicitly to it using the rubric's reasoning criterion.",
        [
          "Excellent effort.",
          "You are a naturally weak writer.",
          "Score: 54%.",
        ],
        "Effective feedback is specific, task-focused, and actionable."
      ),
    ],
  }),
  buildModule({
    code: "PDE 704",
    title: "Principles of Curriculum Design and Development",
    units: 2,
    week: 1,
    strand: "Curriculum",
    duration: "45 min",
    overview:
      "Design coherent curricula by moving from needs and purposes to scope, sequence, learning experiences, assessment, implementation, and evidence-led revision.",
    outcomes: [
      "Distinguish intended, implemented, assessed, and learned curricula.",
      "Apply scope, sequence, continuity, and integration.",
      "Use backward design to align units.",
      "Evaluate curriculum through more than examination averages.",
    ],
    keyIdeas: [
      {
        title: "Curriculum has several layers",
        body:
          "A written syllabus is the intended curriculum. What teachers enact, what assessments reward, what learners actually acquire, and what school routines imply may differ.",
      },
      {
        title: "Coherence across time",
        body:
          "Scope controls breadth; sequence orders increasing complexity; continuity revisits ideas for deeper mastery; integration builds meaningful connections.",
      },
      {
        title: "Development is iterative",
        body:
          "Needs analysis, design, implementation support, monitoring, and revision form a cycle. A technically strong document can still fail without resources and teacher capacity.",
      },
    ],
    classroomPractice: [
      "Audit whether tested content matches stated priorities.",
      "Map prerequisite knowledge before sequencing a unit.",
      "Pilot a change, gather implementation evidence, and revise.",
    ],
    assessment: [
      question(
        "pde704-q1",
        "A syllabus values scientific inquiry, while examinations reward only recalled definitions. Which curriculum relationship is misaligned?",
        "The assessed curriculum is narrowing the intended curriculum.",
        [
          "The hidden curriculum is expanding community participation.",
          "The learned curriculum is necessarily broader than intended.",
          "The null curriculum is identical to the written syllabus.",
        ],
        "Assessment signals what is rewarded and can distort stated intentions."
      ),
      question(
        "pde704-q2",
        "A topic reappears yearly with greater abstraction and new applications. Which design principle is most evident?",
        "Continuity organised through a spiral progression.",
        [
          "Random scope expansion.",
          "Horizontal integration without sequence.",
          "Curriculum omission.",
        ],
        "Spiral progression revisits core ideas at increasing depth and complexity."
      ),
      question(
        "pde704-q3",
        "What is the first major move in backward design?",
        "Clarify the enduring understanding and acceptable evidence before planning activities.",
        [
          "Select entertaining activities before defining outcomes.",
          "Write the final textbook chapter.",
          "Schedule lessons according to page count alone.",
        ],
        "Backward design begins with desired results and evidence."
      ),
      question(
        "pde704-q4",
        "A new digital curriculum is academically coherent but most schools lack devices and teacher preparation. Which evaluation is strongest?",
        "Its design quality is insufficient because feasibility and implementation capacity are part of curriculum effectiveness.",
        [
          "The curriculum is effective because the written objectives are clear.",
          "Resource conditions cannot influence an intended curriculum.",
          "Teachers should independently purchase the missing infrastructure.",
        ],
        "Implementation conditions mediate the relationship between design and learning."
      ),
      question(
        "pde704-q5",
        "Which evidence set best supports curriculum revision?",
        "Assessment patterns, learner work, classroom observations, teacher reports, and participation data disaggregated by group.",
        [
          "A single overall examination mean.",
          "The curriculum writer's personal confidence.",
          "Textbook sales without evidence of use.",
        ],
        "Triangulated and disaggregated evidence reveals outcomes and implementation gaps."
      ),
    ],
  }),
  buildModule({
    code: "PDE 705",
    title: "Measurement and Evaluation",
    units: 2,
    week: 2,
    strand: "Assessment",
    duration: "45 min",
    overview:
      "Build defensible classroom assessments by connecting constructs, items, scoring, reliability, validity, fairness, feedback, and decisions.",
    outcomes: [
      "Differentiate measurement, assessment, and evaluation.",
      "Interpret reliability and validity as evidence-based properties.",
      "Diagnose item and scoring weaknesses.",
      "Use assessment information fairly and proportionately.",
    ],
    keyIdeas: [
      {
        title: "Start with the inference",
        body:
          "Assessment quality depends on what conclusion a score is meant to support. An instrument can be consistent yet measure the wrong construct.",
      },
      {
        title: "Errors have sources",
        body:
          "Ambiguous items, inconsistent scoring, narrow sampling, testing conditions, guessing, and language load can introduce error or construct-irrelevant variance.",
      },
      {
        title: "Consequences matter",
        body:
          "High-stakes decisions need stronger evidence, transparent criteria, appropriate accommodations, and opportunities to question errors.",
      },
    ],
    classroomPractice: [
      "Use a test blueprint before writing items.",
      "Moderate a sample of scored work with another teacher.",
      "Review item difficulty, discrimination, omissions, and distractor functioning.",
    ],
    assessment: [
      question(
        "pde705-q1",
        "A test produces nearly identical scores on two occasions but covers only one small part of the intended competence. Which judgment is correct?",
        "It may be reliable while lacking adequate content-validity evidence.",
        [
          "High reliability automatically proves full validity.",
          "Content validity is irrelevant when scores are stable.",
          "The construct must be unidimensional because scores repeat.",
        ],
        "Consistency does not establish that the intended domain was adequately represented."
      ),
      question(
        "pde705-q2",
        "High-performing learners choose the keyed answer less often than low-performing learners on one item. What should be investigated first?",
        "A miskey, ambiguity, or a distractor that is more defensible than the key.",
        [
          "Whether high performers studied too much.",
          "Whether the item should automatically receive more marks.",
          "Whether all low performers should pass the test.",
        ],
        "Negative discrimination often signals an item or key problem."
      ),
      question(
        "pde705-q3",
        "A mathematics test uses unnecessarily complex prose, causing multilingual learners to fail otherwise familiar calculations. This primarily threatens validity through:",
        "Construct-irrelevant language variance.",
        [
          "Construct underrepresentation caused by too many calculations.",
          "Perfect scorer reliability.",
          "Criterion-referenced interpretation.",
        ],
        "Language demands unrelated to the intended mathematics contaminate the score."
      ),
      question(
        "pde705-q4",
        "Which action most directly improves inter-rater reliability for an essay assessment?",
        "Use an analytic rubric, annotated exemplars, scorer calibration, and blind double-scoring of a sample.",
        [
          "Allow every scorer to invent personal criteria.",
          "Replace all writing with attendance marks.",
          "Tell scorers the learner's previous grades.",
        ],
        "Shared criteria and calibration reduce inconsistent judgment."
      ),
      question(
        "pde705-q5",
        "Why is a single test score usually insufficient for a major placement decision?",
        "All scores contain error and sample performance, so consequential decisions need corroborating evidence.",
        [
          "Numbers can never contribute to educational decisions.",
          "Placement should depend only on teacher intuition.",
          "A test score describes every future learning condition perfectly.",
        ],
        "The strength of evidence should be proportionate to the consequence of the decision."
      ),
    ],
  }),
  buildModule({
    code: "PDE 706",
    title: "Educational Psychology",
    units: 2,
    week: 2,
    strand: "Learning science",
    duration: "45 min",
    overview:
      "Translate evidence about attention, memory, prior knowledge, motivation, transfer, practice, and metacognition into classroom decisions.",
    outcomes: [
      "Manage working-memory demands without reducing intellectual challenge.",
      "Use retrieval and spacing to strengthen long-term learning.",
      "Diagnose motivation through value, expectancy, and belonging.",
      "Design for transfer beyond familiar examples.",
    ],
    keyIdeas: [
      {
        title: "Memory is active",
        body:
          "Working memory is limited. Prior knowledge, chunking, clear models, and reduced extraneous load make complex reasoning more manageable.",
      },
      {
        title: "Performance is not retention",
        body:
          "Fluent rereading can feel successful. Effortful retrieval, spacing, varied practice, and feedback produce stronger long-term access.",
      },
      {
        title: "Motivation is contextual",
        body:
          "Learners engage when they expect progress, value the task, experience belonging, and retain meaningful agency. Rewards can help or harm depending on how they are used.",
      },
    ],
    classroomPractice: [
      "Begin with a short retrieval prompt before adding new material.",
      "Use worked examples, then fade steps as expertise grows.",
      "Ask learners to explain when a strategy applies and when it does not.",
    ],
    assessment: [
      question(
        "pde706-q1",
        "Novices study a diagram while searching a distant paragraph for labels and instructions. Which redesign best reduces extraneous cognitive load?",
        "Integrate concise labels and essential guidance beside the relevant diagram features.",
        [
          "Add decorative animation to hold attention.",
          "Remove the diagram and require memorisation first.",
          "Present two unrelated examples simultaneously.",
        ],
        "Spatially integrated information reduces split attention without reducing germane challenge."
      ),
      question(
        "pde706-q2",
        "Learners reread notes until the material feels familiar but cannot recall it a week later. Which change has the strongest rationale?",
        "Use spaced, low-stakes retrieval with corrective feedback.",
        [
          "Increase highlighting without testing recall.",
          "Repeat the same reading in one longer sitting.",
          "Delay all feedback until the term ends.",
        ],
        "Retrieval and spacing strengthen access and reveal knowledge gaps."
      ),
      question(
        "pde706-q3",
        "A learner says, 'People like me do not succeed in physics.' Which response addresses more than surface compliance?",
        "Combine attainable challenge and strategy feedback with credible belonging cues and examples of growth.",
        [
          "Promise marks for silence during physics.",
          "Lower every task until errors are impossible.",
          "Say confidence is a personality trait that cannot change.",
        ],
        "Expectancy, strategy, belonging, and authentic success experiences interact."
      ),
      question(
        "pde706-q4",
        "Which practice is most likely to produce far transfer?",
        "Compare structurally similar problems across different surface contexts and justify the underlying principle.",
        [
          "Repeat one item with only the numbers changed.",
          "Memorise a solution without explaining its conditions.",
          "Avoid mixed practice until after graduation.",
        ],
        "Transfer improves when learners recognise deep structure across varied contexts."
      ),
      question(
        "pde706-q5",
        "A reward increases worksheet completion but learners stop the activity when rewards disappear. What is the best interpretation?",
        "The reward altered short-term behaviour without necessarily strengthening task value or autonomous motivation.",
        [
          "Any increase in completion proves durable intrinsic motivation.",
          "Rewards always destroy learning regardless of context.",
          "Motivation cannot be influenced by classroom design.",
        ],
        "Observable compliance and enduring motivation are different outcomes."
      ),
    ],
  }),
  buildModule({
    code: "PDE 707",
    title: "Philosophy of Education",
    units: 2,
    week: 2,
    strand: "Foundations",
    duration: "35 min",
    overview:
      "Examine assumptions about knowledge, values, persons, society, freedom, authority, and the purposes of schooling so everyday practice becomes intellectually defensible.",
    outcomes: [
      "Identify philosophical assumptions hidden in policy and pedagogy.",
      "Distinguish descriptive claims from normative arguments.",
      "Evaluate educational positions for coherence and consequences.",
      "Build reasoned practice from explicit values.",
    ],
    keyIdeas: [
      {
        title: "Every practice implies a purpose",
        body:
          "Choices about curriculum, discipline, assessment, and authority reflect beliefs about what knowledge matters, what a learner is, and what society should become.",
      },
      {
        title: "Arguments need reasons",
        body:
          "A philosophical claim is not established by popularity or tradition alone. Its concepts, premises, implications, and counterexamples must be examined.",
      },
      {
        title: "Tensions require judgment",
        body:
          "Education repeatedly balances autonomy and authority, individual and community, inheritance and critique, equality and difference, knowledge and experience.",
      },
    ],
    classroomPractice: [
      "Name the value being protected when applying a rule.",
      "Test a policy principle against a difficult counterexample.",
      "Separate what evidence shows from what educators ought to do.",
    ],
    assessment: [
      question(
        "pde707-q1",
        "A policy states, 'Because employers prefer digital skills, schools ought to remove the arts.' What is the main philosophical gap?",
        "The descriptive premise does not by itself justify the normative conclusion or settle competing educational aims.",
        [
          "Employer preferences are impossible to investigate.",
          "Arts subjects have no educational purpose.",
          "Normative claims never require reasons.",
        ],
        "Moving from what is to what ought to be requires value premises and consideration of alternatives."
      ),
      question(
        "pde707-q2",
        "A teacher claims learners should accept a proposition only after examining evidence and reasons. Which orientation is most directly expressed?",
        "An epistemic commitment to justified belief and critical inquiry.",
        [
          "Aesthetic relativism about classroom decoration.",
          "Economic determinism about school funding.",
          "Behavioural conditioning without regard to truth.",
        ],
        "The claim concerns what counts as warranted knowledge."
      ),
      question(
        "pde707-q3",
        "Which rule best reconciles learner freedom with legitimate classroom authority?",
        "Restrictions should be transparent, proportionate, educationally justified, and open to reasoned review.",
        [
          "Any learner preference overrides every communal need.",
          "Teacher authority needs no reason because it is official.",
          "Freedom exists only when there are no shared obligations.",
        ],
        "Legitimate authority can protect learning while remaining accountable to reasons."
      ),
      question(
        "pde707-q4",
        "Why is 'this practice is traditional' an incomplete defence of an educational practice?",
        "Tradition explains continuity but does not establish moral or educational justification.",
        [
          "All inherited practices are necessarily harmful.",
          "Historical facts can never enter an argument.",
          "Only new practices can be rational.",
        ],
        "Origin and longevity do not by themselves prove that a practice ought to continue."
      ),
      question(
        "pde707-q5",
        "A school values equal dignity but permanently channels low-income learners into a narrowed curriculum. Which critique is strongest?",
        "The practice is incoherent with its stated value because formal treatment masks unequal educational opportunity.",
        [
          "Values never constrain institutional arrangements.",
          "Curriculum breadth has no relationship to opportunity.",
          "Equal dignity requires identical test scores.",
        ],
        "Philosophical analysis tests whether practices cohere with declared principles."
      ),
    ],
  }),
  buildModule({
    code: "PDE 708",
    title: "Research Methods in Education",
    units: 2,
    week: 2,
    strand: "Inquiry",
    duration: "50 min",
    overview:
      "Frame answerable questions, choose designs from the inference required, collect ethical evidence, analyse it appropriately, and communicate warranted conclusions.",
    outcomes: [
      "Align questions, designs, samples, measures, and analyses.",
      "Separate association from causal inference.",
      "Identify threats to credibility and transfer.",
      "Apply consent, privacy, and safeguarding principles.",
    ],
    keyIdeas: [
      {
        title: "Design follows the question",
        body:
          "Descriptive, correlational, causal, interpretive, and improvement questions require different forms of evidence. A method is strong only relative to the claim.",
      },
      {
        title: "Validity is designed, not announced",
        body:
          "Selection, attrition, history, measurement, researcher influence, and context can threaten conclusions. Triangulation and transparent limitations strengthen interpretation.",
      },
      {
        title: "Participants are not data sources alone",
        body:
          "Educational research must protect voluntary participation, confidentiality, welfare, and fair treatment, especially where authority relationships make refusal difficult.",
      },
    ],
    classroomPractice: [
      "Turn a broad concern into a bounded, answerable question.",
      "State the strongest claim the design can and cannot support.",
      "Plan data minimisation and secure handling before collection.",
    ],
    assessment: [
      question(
        "pde708-q1",
        "A school introduces tutoring to the lowest-scoring class and later compares it with the highest-scoring class. Scores converge. Why is a causal claim weak?",
        "Initial selection differences and regression toward the mean are confounded with the tutoring effect.",
        [
          "Any comparison involving scores is qualitative.",
          "Causal claims require every participant to improve equally.",
          "Tutoring cannot be researched in schools.",
        ],
        "Non-equivalent selection based on extreme scores creates major alternative explanations."
      ),
      question(
        "pde708-q2",
        "Which research question is best suited to an interpretive interview design?",
        "How do first-year teachers make sense of feedback received during school inspection?",
        [
          "What proportion of teachers submitted plans by Friday?",
          "Does random assignment to feedback formats change test scores?",
          "What is the national mean attendance rate?",
        ],
        "Interpretive interviews examine meaning, experience, and perspective."
      ),
      question(
        "pde708-q3",
        "A principal orders teachers to participate in her study and collects identifiable criticism. Which ethical problem is most serious?",
        "Authority pressure undermines voluntary consent and identifiability increases retaliation risk.",
        [
          "The study lacks a colourful questionnaire.",
          "Teachers can never participate in workplace research.",
          "Criticism is not a form of research data.",
        ],
        "Power relationships and confidentiality must be addressed in consent and data design."
      ),
      question(
        "pde708-q4",
        "Survey respondents who leave an item blank are systematically the most overworked teachers. Treating all missing data as random would most likely:",
        "Bias estimates because missingness is related to the phenomenon being studied.",
        [
          "Guarantee a representative sample.",
          "Convert the study into an experiment.",
          "Increase construct validity automatically.",
        ],
        "Systematic nonresponse can distort results."
      ),
      question(
        "pde708-q5",
        "Which conclusion is warranted by a strong correlation between attendance and achievement in observational data?",
        "Attendance and achievement vary together, but the direction and causal mechanism remain unresolved.",
        [
          "Increasing attendance will certainly cause the full observed score difference.",
          "Achievement cannot influence attendance.",
          "No third variable could affect both measures.",
        ],
        "Correlation supports association, not a uniquely identified causal pathway."
      ),
    ],
  }),
  buildModule({
    code: "PDE 709",
    title: "Sociology of Education",
    units: 2,
    week: 3,
    strand: "School and society",
    duration: "40 min",
    overview:
      "Analyse schooling as a social institution that can expand opportunity while reproducing inequality through culture, grouping, expectations, language, credentials, and resource distribution.",
    outcomes: [
      "Use multiple sociological lenses on the same school practice.",
      "Recognise hidden curriculum and institutional sorting.",
      "Interpret inequality without blaming learners or families.",
      "Design more inclusive participation structures.",
    ],
    keyIdeas: [
      {
        title: "Functions and conflicts",
        body:
          "Schools transmit knowledge and social norms, allocate roles, and build cohesion, but they also distribute valued credentials and may reproduce unequal power.",
      },
      {
        title: "Culture becomes institutional",
        body:
          "Language styles, behaviour expectations, examples, networks, and familiarity with school codes can be treated as merit even when access to them is unequal.",
      },
      {
        title: "Expectations shape pathways",
        body:
          "Labels and ability groups can influence opportunities, identity, teacher attention, peer networks, and later outcomes, sometimes creating self-fulfilling patterns.",
      },
    ],
    classroomPractice: [
      "Audit who speaks, leads, receives feedback, and accesses advanced tasks.",
      "Teach hidden academic conventions explicitly.",
      "Use disaggregated evidence before explaining achievement gaps.",
    ],
    assessment: [
      question(
        "pde709-q1",
        "A school rewards debate styles common in affluent homes but treats unfamiliar styles as lack of ability. Which concept best explains the pattern?",
        "Institutional conversion of dominant cultural capital into apparent merit.",
        [
          "Biological maturation independent of context.",
          "Random measurement error with no social pattern.",
          "Universal access to identical social resources.",
        ],
        "Institutions may privilege cultural resources unequally distributed across groups."
      ),
      question(
        "pde709-q2",
        "Low-track learners receive simpler tasks, fewer explanations, and little chance to move groups. Their results then decline. This is strongest evidence of:",
        "A labelling and opportunity process that can become self-fulfilling.",
        [
          "Proof that the original labels measured fixed ability perfectly.",
          "Equal educational treatment across tracks.",
          "A curriculum unrelated to expectations.",
        ],
        "Placement can alter opportunity to learn and reinforce the outcome it predicted."
      ),
      question(
        "pde709-q3",
        "Which finding most clearly concerns the hidden curriculum?",
        "Learners infer that obedience and punctuality are rewarded more consistently than questioning authority.",
        [
          "The written science syllabus lists energy concepts.",
          "A timetable allocates five periods to mathematics.",
          "A textbook defines socialisation.",
        ],
        "The hidden curriculum consists of implicit norms and messages conveyed by institutional life."
      ),
      question(
        "pde709-q4",
        "A school explains an attendance gap as parental indifference without examining transport, work, disability, or safety. What error is it making?",
        "Individualising a patterned outcome while ignoring structural constraints.",
        [
          "Using too many structural explanations.",
          "Treating attendance as measurable.",
          "Assuming institutions influence behaviour.",
        ],
        "Sociological analysis examines how systems structure available choices."
      ),
      question(
        "pde709-q5",
        "Which intervention most directly reduces the advantage of knowing unspoken school rules?",
        "Make success criteria, academic language, help-seeking routes, and progression expectations explicit to everyone.",
        [
          "Keep expectations implicit so learners discover them independently.",
          "Reward only families already familiar with school procedures.",
          "Remove all standards to eliminate inequality.",
        ],
        "Explicit access to institutional knowledge supports equity without abandoning standards."
      ),
    ],
  }),
  buildModule({
    code: "PDE 710",
    title: "Statistical Methods in Education",
    units: 2,
    week: 3,
    strand: "Data literacy",
    duration: "50 min",
    overview:
      "Interpret educational data with attention to distributions, uncertainty, effect size, sampling, assumptions, and the difference between statistical and educational importance.",
    outcomes: [
      "Choose summaries appropriate to a distribution and scale.",
      "Interpret variability, uncertainty, and effect size.",
      "Avoid common causal and significance errors.",
      "Communicate results in decision-relevant language.",
    ],
    keyIdeas: [
      {
        title: "The average can conceal the pattern",
        body:
          "Means, medians, proportions, ranges, and standard deviations answer different questions. Skew, outliers, ceiling effects, and subgroup differences matter.",
      },
      {
        title: "Samples vary",
        body:
          "Confidence intervals and standard errors describe sampling uncertainty under assumptions. A p-value is not the probability that a hypothesis is true.",
      },
      {
        title: "Importance needs context",
        body:
          "Large samples can make trivial differences statistically significant. Effect size, costs, baseline risk, equity, and practical consequences guide decisions.",
      },
    ],
    classroomPractice: [
      "Plot a distribution before selecting a summary.",
      "Report uncertainty and effect size beside test results.",
      "Ask whether missing or excluded observations change the conclusion.",
    ],
    assessment: [
      question(
        "pde710-q1",
        "Most learners score between 65 and 80, but one data-entry error records 800. Which measure best represents the typical score before correction?",
        "The median, because it is resistant to the extreme value.",
        [
          "The mean, because extreme values never affect it.",
          "The range, because it is a measure of centre.",
          "The variance, because it identifies the typical learner directly.",
        ],
        "The median is robust to an extreme outlier."
      ),
      question(
        "pde710-q2",
        "A difference of 0.3 marks is statistically significant in a sample of 100,000 learners. What should a decision-maker ask next?",
        "Whether the effect size and educational consequences are meaningful enough to justify action.",
        [
          "Whether statistical significance proves a large effect.",
          "Whether the null hypothesis has a 95% probability of being false.",
          "Whether all learners improved by exactly 0.3 marks.",
        ],
        "Statistical detectability and practical importance are distinct."
      ),
      question(
        "pde710-q3",
        "A 95% confidence interval for a mean difference is 2.1 to 5.4. Which interpretation is most defensible?",
        "Under the model and sampling assumptions, values in that range are compatible with the observed data at the stated confidence level.",
        [
          "There is a 95% probability that this fixed interval contains the already-fixed parameter.",
          "Ninety-five per cent of individual score differences fall in the interval.",
          "The intervention works for 95% of all learners.",
        ],
        "A confidence interval quantifies procedure-based sampling uncertainty, not individual outcomes."
      ),
      question(
        "pde710-q4",
        "Two classes have the same mean but one has a much larger standard deviation. What can be concluded?",
        "Their centres match, but learner scores are more dispersed in the second class.",
        [
          "The two score distributions are identical.",
          "The second class necessarily has the higher median.",
          "The first class has more learners.",
        ],
        "Equal means do not imply equal variability or distribution shape."
      ),
      question(
        "pde710-q5",
        "Achievement rises with hours of private tutoring. Which statistical issue most directly prevents a simple causal interpretation?",
        "Selection and confounding may influence both tutoring uptake and achievement.",
        [
          "Positive correlations are mathematically impossible.",
          "Causality requires a correlation of exactly zero.",
          "Achievement cannot be represented numerically.",
        ],
        "Observed association may reflect prior attainment, income, motivation, or other differences."
      ),
    ],
  }),
  buildModule({
    code: "PDE 711",
    title: "Micro-Teaching",
    units: 1,
    week: 3,
    strand: "Professional practice",
    duration: "35 min",
    overview:
      "Use short, focused teaching cycles to practise a specific skill, gather precise evidence, revise, and reteach under manageable conditions.",
    outcomes: [
      "Define a narrow, observable practice target.",
      "Collect evidence aligned to that target.",
      "Give and receive descriptive feedback.",
      "Use rehearsal as a cycle rather than a performance verdict.",
    ],
    keyIdeas: [
      {
        title: "Reduce complexity deliberately",
        body:
          "Micro-teaching narrows lesson length, learner group, content, and target skill so the teacher can attend to one aspect of practice.",
      },
      {
        title: "Feedback must be usable",
        body:
          "Evidence should describe what occurred, its effect on learners, and one feasible adjustment. Personality judgments do not guide revision.",
      },
      {
        title: "Reteaching completes the cycle",
        body:
          "Plan, teach, observe, analyse, revise, and reteach. Improvement is tested through a second enactment rather than assumed after discussion.",
      },
    ],
    classroomPractice: [
      "Rehearse one hinge question and the response to each likely answer.",
      "Video a short segment with consent and code evidence by target skill.",
      "Limit peer feedback to one evidence-based strength and one next move.",
    ],
    assessment: [
      question(
        "pde711-q1",
        "A trainee teaches a complete 80-minute lesson while peers comment on voice, content, discipline, board work, questioning, and dress. Why is this weak micro-teaching?",
        "The teaching episode and feedback targets are too broad to isolate and deliberately improve one skill.",
        [
          "Micro-teaching must never involve peers.",
          "A lesson becomes micro-teaching only when no content is taught.",
          "Feedback is invalid unless it is anonymous.",
        ],
        "Micro-teaching manages complexity through a short episode and focused target."
      ),
      question(
        "pde711-q2",
        "Which feedback statement is most actionable?",
        "After the question, you waited one second; extending wait time may bring in learners who were still formulating an answer.",
        [
          "You are not naturally confident.",
          "That lesson was generally poor.",
          "Try to be more like the most experienced teacher.",
        ],
        "It identifies observable evidence, likely effect, and a specific adjustment."
      ),
      question(
        "pde711-q3",
        "What most clearly distinguishes a completed micro-teaching cycle from a one-off demonstration?",
        "The trainee revises from evidence and reteaches to test the adjustment.",
        [
          "The observer assigns a permanent grade.",
          "The trainee memorises the original script.",
          "The class applauds at the end.",
        ],
        "Reteaching turns feedback into tested professional learning."
      ),
      question(
        "pde711-q4",
        "The target skill is checking for understanding. Which observation evidence is best aligned?",
        "The questions asked, distribution of responses, misconceptions revealed, and instructional changes that followed.",
        [
          "The colour of the trainee's clothing.",
          "The total number of pages in the lesson plan.",
          "The observer's overall impression of charisma.",
        ],
        "Evidence should directly sample the target practice and learner response."
      ),
      question(
        "pde711-q5",
        "A trainee becomes defensive after receiving ten improvement points. Which redesign best supports learning?",
        "Prioritise one high-leverage target, ground it in evidence, rehearse an alternative, and schedule reteaching.",
        [
          "Add more unranked criticism to ensure completeness.",
          "Avoid all feedback to protect confidence.",
          "Discuss the trainee's personality rather than the lesson.",
        ],
        "Focused, evidence-based feedback reduces overload and enables deliberate practice."
      ),
    ],
  }),
  buildModule({
    code: "PDE 712",
    title: "Guidance and Counselling",
    units: 2,
    week: 3,
    strand: "Learner support",
    duration: "45 min",
    overview:
      "Provide ethical, developmentally appropriate guidance while maintaining boundaries, confidentiality, documentation, referral, and safeguarding duties.",
    outcomes: [
      "Distinguish guidance, counselling, discipline, and clinical care.",
      "Use attending, empathy, clarification, and referral appropriately.",
      "Explain the limits of confidentiality before disclosure.",
      "Respond safely to risk without making unsupported promises.",
    ],
    keyIdeas: [
      {
        title: "Help without taking over",
        body:
          "Guidance provides information and structured support; counselling helps a learner explore concerns and choices. The adult does not impose a personal solution.",
      },
      {
        title: "Confidentiality has limits",
        body:
          "Privacy builds trust, but imminent harm, abuse, and safeguarding concerns require proportionate disclosure through authorised pathways.",
      },
      {
        title: "Boundaries protect everyone",
        body:
          "Competence, role clarity, factual records, supervised referral, and avoidance of dual relationships protect learners and staff.",
      },
    ],
    classroomPractice: [
      "State privacy limits in language a learner understands.",
      "Document exact words and observable facts, not diagnostic conclusions.",
      "Know the school's designated safeguarding and referral route.",
    ],
    assessment: [
      question(
        "pde712-q1",
        "Before a learner shares a serious concern, what is the most ethical opening?",
        "Explain that the conversation is private except when safety or safeguarding requires involving the appropriate people.",
        [
          "Promise absolute secrecy under every circumstance.",
          "Invite classmates to ensure transparency.",
          "State that every detail will automatically be sent to all staff.",
        ],
        "Informed trust requires clear, proportionate limits to confidentiality."
      ),
      question(
        "pde712-q2",
        "A learner discloses credible intent to seriously harm himself that evening. What should the teacher do first?",
        "Maintain supervision, follow the urgent safeguarding pathway, and share necessary information with responsible professionals.",
        [
          "Keep the disclosure secret to preserve rapport.",
          "Ask the learner to return next week and continue teaching.",
          "Investigate independently before notifying anyone.",
        ],
        "Immediate safety overrides ordinary confidentiality."
      ),
      question(
        "pde712-q3",
        "Which response demonstrates empathy without claiming an experience the counsellor has not had?",
        "It sounds as though the uncertainty has been exhausting; tell me what feels hardest right now.",
        [
          "I know exactly how you feel.",
          "Other learners have much worse problems.",
          "You should simply stop thinking about it.",
        ],
        "Accurate reflection invites exploration without appropriation or minimisation."
      ),
      question(
        "pde712-q4",
        "A teacher suspects a clinical condition after one conversation. What is the best next step?",
        "Record relevant observations, continue appropriate support, and refer through the established professional pathway.",
        [
          "Announce a diagnosis so colleagues can prepare.",
          "Prescribe treatment based on internet research.",
          "Do nothing because teachers cannot notice concerns.",
        ],
        "Teachers can observe and refer but should not diagnose beyond competence."
      ),
      question(
        "pde712-q5",
        "Which question most supports learner agency in a non-emergency decision?",
        "What options do you see, and what might each option mean for what matters to you?",
        [
          "Why have you refused to do the obvious thing?",
          "Wouldn't you agree that my choice is the only sensible one?",
          "Can I decide for you so this ends quickly?",
        ],
        "Open exploration supports informed decision-making rather than dependence."
      ),
    ],
  }),
  buildModule({
    code: "PDE 713",
    title: "Introduction to Educational Management and Planning",
    units: 2,
    week: 4,
    strand: "Leadership",
    duration: "45 min",
    overview:
      "Translate school purposes into priorities, resources, responsibilities, implementation routines, evidence, and adaptive decisions.",
    outcomes: [
      "Distinguish strategic goals from activities.",
      "Use needs evidence to prioritise scarce resources.",
      "Assign responsibility, indicators, timelines, and risks.",
      "Monitor implementation without confusing compliance with impact.",
    ],
    keyIdeas: [
      {
        title: "Plans connect means to ends",
        body:
          "A credible plan states the problem, desired result, strategy, resources, owner, timeline, indicators, assumptions, and review point.",
      },
      {
        title: "Priorities involve trade-offs",
        body:
          "Schools cannot do everything at once. Leaders weigh urgency, educational value, equity, feasibility, dependency, and opportunity cost.",
      },
      {
        title: "Management is adaptive",
        body:
          "Monitoring asks whether actions happened and whether conditions changed. Evidence should trigger support, redesign, scaling, or stopping.",
      },
    ],
    classroomPractice: [
      "Write one measurable outcome for each major initiative.",
      "Name a single accountable owner while preserving team contribution.",
      "Schedule short review cycles with leading and outcome indicators.",
    ],
    assessment: [
      question(
        "pde713-q1",
        "A school improvement plan lists 'hold workshops' as its main goal. What is missing?",
        "A defined learner or organisational outcome that the workshops are expected to produce.",
        [
          "A larger number of activities regardless of need.",
          "A promise that no plan will change.",
          "A rule excluding evidence from review.",
        ],
        "An activity is a means; planning should specify the intended result."
      ),
      question(
        "pde713-q2",
        "Three urgent initiatives exceed available staff time. Which prioritisation process is strongest?",
        "Compare expected educational impact, equity, urgency, feasibility, dependencies, and opportunity costs using explicit evidence.",
        [
          "Choose the proposal made by the most senior speaker.",
          "Attempt all initiatives without adjusting resources.",
          "Select the initiative with the longest title.",
        ],
        "Transparent criteria improve strategic trade-offs and accountability."
      ),
      question(
        "pde713-q3",
        "Attendance messages were sent as planned, but absence did not improve. What should monitoring conclude?",
        "Implementation occurred, but outcome evidence requires diagnosis and possible strategy revision.",
        [
          "The plan succeeded because every message was sent.",
          "The attendance measure must be ignored.",
          "More messages will certainly solve every cause of absence.",
        ],
        "Output completion and outcome improvement are different."
      ),
      question(
        "pde713-q4",
        "Why should a major action have one accountable owner even when a team delivers it?",
        "Clear accountability reduces diffusion while the owner coordinates distributed work.",
        [
          "Only one person should be allowed to contribute.",
          "Teams cannot share information.",
          "Accountability makes timelines unnecessary.",
        ],
        "Single-point accountability clarifies follow-through without eliminating collaboration."
      ),
      question(
        "pde713-q5",
        "Which indicator is the strongest leading signal for a reading intervention?",
        "The proportion of scheduled small-group sessions delivered with the intended learners and routine.",
        [
          "National examination results two years later only.",
          "The number of pages in the programme manual.",
          "The principal's confidence before implementation.",
        ],
        "A leading indicator gives early evidence about implementation likely to influence later outcomes."
      ),
    ],
  }),
  buildModule({
    code: "PDE 714",
    title: "Guidance and Counselling II",
    units: 2,
    week: 4,
    strand: "Learner support",
    duration: "45 min",
    overview:
      "Apply structured counselling processes to academic, career, behavioural, relational, crisis, and referral contexts while protecting learner agency and safety.",
    outcomes: [
      "Conduct purposeful helping conversations.",
      "Use assessment information without deterministic labels.",
      "Support career exploration through person-opportunity fit.",
      "Recognise crisis, referral, and follow-up requirements.",
    ],
    keyIdeas: [
      {
        title: "A conversation has a process",
        body:
          "Engagement, clarification, goal agreement, option exploration, action planning, and follow-up provide structure without turning counselling into an interrogation.",
      },
      {
        title: "Information expands choice",
        body:
          "Interests, values, strengths, constraints, labour information, and educational pathways inform decisions. No single inventory should dictate a life direction.",
      },
      {
        title: "Referral is an active handover",
        body:
          "Effective referral explains the reason, obtains appropriate consent, connects to a competent service, shares only necessary information, and follows up.",
      },
    ],
    classroomPractice: [
      "Agree a specific, learner-owned goal before proposing actions.",
      "Use career tools as hypotheses for exploration.",
      "Close the referral loop while respecting privacy.",
    ],
    assessment: [
      question(
        "pde714-q1",
        "A career inventory suggests engineering, but the learner values public service and dislikes the work contexts described. What is the best use of the result?",
        "Treat it as one hypothesis to explore alongside values, abilities, opportunities, and lived preferences.",
        [
          "Require engineering because the inventory is objective.",
          "Discard all assessment information permanently.",
          "Assume interests can never change with experience.",
        ],
        "Career tools inform exploration; they do not determine identity or choice."
      ),
      question(
        "pde714-q2",
        "Which goal is best formed for a counselling action plan?",
        "For the next two weeks, the learner will use the agreed planner each school day and review barriers every Friday.",
        [
          "The learner will become more responsible.",
          "The counsellor will solve the learner's life.",
          "Everything will improve soon.",
        ],
        "Useful goals are specific, observable, time-bounded, and reviewable."
      ),
      question(
        "pde714-q3",
        "A referral note includes unrelated family gossip and labels the learner 'manipulative.' What principle is violated most directly?",
        "Data minimisation and objective, purpose-limited documentation.",
        [
          "The need to make every record as long as possible.",
          "The requirement to diagnose before referral.",
          "The rule that referrals must be public.",
        ],
        "Records should contain necessary facts and avoid prejudicial interpretation."
      ),
      question(
        "pde714-q4",
        "A learner agrees to an action in the meeting but repeatedly cannot carry it out. What should follow?",
        "Review whether the goal was truly shared, identify barriers, and revise the plan collaboratively.",
        [
          "Conclude immediately that the learner is unwilling.",
          "Repeat the same plan indefinitely without inquiry.",
          "End support because action plans cannot change.",
        ],
        "Follow-up tests feasibility and keeps the learner involved in problem solving."
      ),
      question(
        "pde714-q5",
        "Which feature turns referral into a responsible handover rather than a dismissal?",
        "A clear reason, appropriate consent, a reachable service, necessary information, and planned follow-up.",
        [
          "Telling the learner to search for help alone.",
          "Sending every school record to an unknown contact.",
          "Ending all contact immediately after naming a service.",
        ],
        "Continuity and proportionate information-sharing protect the learner."
      ),
    ],
  }),
  buildModule({
    code: "PDE 715",
    title: "Subject Methods: English, Mathematics, Social Studies and ICT",
    units: 2,
    week: 4,
    strand: "Subject pedagogy",
    duration: "55 min",
    overview:
      "Use discipline-specific representations, inquiry, language, practice, misconceptions, and authentic tasks rather than relying on generic activity alone.",
    outcomes: [
      "Identify what makes knowledge and evidence distinctive in each subject.",
      "Select representations that reveal rather than hide structure.",
      "Anticipate high-value misconceptions.",
      "Move learners from supported performance to independent transfer.",
    ],
    keyIdeas: [
      {
        title: "English and meaning",
        body:
          "Language learning integrates reading, writing, speaking, listening, vocabulary, grammar in context, audience, purpose, drafting, and response to texts.",
      },
      {
        title: "Mathematics and structure",
        body:
          "Conceptual understanding, procedural fluency, reasoning, and problem solving reinforce one another when learners connect concrete, visual, symbolic, and verbal representations.",
      },
      {
        title: "Social Studies and ICT inquiry",
        body:
          "Social Studies weighs sources, perspective, citizenship, and context. ICT combines computational thinking, tool fluency, digital creation, safety, evaluation, and debugging.",
      },
    ],
    classroomPractice: [
      "Ask what counts as evidence in the discipline.",
      "Plan one misconception and the representation that will expose it.",
      "Assess explanation and transfer, not only product completion.",
    ],
    assessment: [
      question(
        "pde715-q1",
        "Learners can execute the standard division algorithm but cannot explain why it works. Which task best develops mathematical understanding?",
        "Connect place-value blocks, partial quotients, equations, and the standard notation while comparing the same operation.",
        [
          "Assign more identical algorithm drills without representation.",
          "Remove all discussion to protect speed.",
          "Ask learners to memorise the answer key.",
        ],
        "Connecting representations reveals the structure beneath a procedure."
      ),
      question(
        "pde715-q2",
        "Which English-writing sequence most authentically treats writing as purposeful communication?",
        "Analyse audience and models, plan, draft, receive focused feedback, revise meaning, edit, and publish.",
        [
          "Copy a model once and submit it without revision.",
          "Correct punctuation before deciding what the text should communicate.",
          "Memorise isolated grammar rules and never compose.",
        ],
        "Purpose, audience, drafting, response, revision, and editing form a coherent writing process."
      ),
      question(
        "pde715-q3",
        "Two historical accounts disagree about a community conflict. What is the strongest Social Studies response?",
        "Source each account, compare evidence and perspective, corroborate claims, and explain remaining uncertainty.",
        [
          "Select the longer account as automatically true.",
          "Avoid the disagreement because citizenship requires unanimity.",
          "Average the two stories into a single unsupported claim.",
        ],
        "Disciplinary inquiry evaluates provenance, evidence, perspective, and corroboration."
      ),
      question(
        "pde715-q4",
        "A learner's program produces the right output for one input but fails at boundary values. Which ICT teaching move is best?",
        "Use a test set including normal, boundary, and invalid cases, then trace the algorithm to locate the fault.",
        [
          "Accept the first successful output as complete proof.",
          "Rewrite the code for the learner without explanation.",
          "Test only the same input repeatedly.",
        ],
        "Systematic testing and tracing develop debugging and algorithmic reasoning."
      ),
      question(
        "pde715-q5",
        "What common principle connects effective teaching across these four subjects?",
        "Learners must participate in the subject's characteristic ways of representing, reasoning, communicating, and validating claims.",
        [
          "Every subject should use the identical task regardless of knowledge structure.",
          "Activity level is sufficient evidence of disciplinary learning.",
          "Subject-specific misconceptions should be ignored.",
        ],
        "Strong pedagogy is responsive to the epistemic practices of a discipline."
      ),
    ],
  }),
  buildModule({
    code: "PDE 716",
    title: "Educational Supervision and School Inspection",
    units: 1,
    week: 4,
    strand: "Quality assurance",
    duration: "40 min",
    overview:
      "Use supervision and inspection to protect standards, diagnose conditions, support professional growth, and improve learning through transparent evidence and follow-up.",
    outcomes: [
      "Distinguish developmental supervision from external inspection.",
      "Collect representative evidence rather than isolated impressions.",
      "Conduct fair pre-observation, observation, and feedback cycles.",
      "Link findings to support, responsibility, and review.",
    ],
    keyIdeas: [
      {
        title: "Different purposes, related evidence",
        body:
          "Supervision primarily develops practice within an organisation; inspection provides independent assurance against standards. Both require credible evidence and procedural fairness.",
      },
      {
        title: "Observe learning, not theatre",
        body:
          "Lesson evidence includes task demand, learner thinking, participation, checking for understanding, work, climate, and response—not a preferred performance style.",
      },
      {
        title: "Follow-up gives findings value",
        body:
          "A report should distinguish evidence, interpretation, judgment, required action, support, owner, timeline, and verification.",
      },
    ],
    classroomPractice: [
      "Agree the observation focus and relevant context beforehand.",
      "Triangulate observation, learner work, plans, assessment, and voice.",
      "Convert each priority finding into a supported, reviewable action.",
    ],
    assessment: [
      question(
        "pde716-q1",
        "An observer rates a teacher poorly because the lesson did not use group work, although learners met a demanding objective through another method. What is the main error?",
        "Judging conformity to a preferred method instead of evaluating evidence against purpose and standards.",
        [
          "Considering learner evidence at all.",
          "Allowing more than one teaching method to exist.",
          "Observing the relationship between task and objective.",
        ],
        "Quality is not identical to a single observable teaching style."
      ),
      question(
        "pde716-q2",
        "Which evidence base is strongest for a school-level judgment?",
        "Multiple observations, learner work, progress data, records, interviews, and context sampled across time.",
        [
          "One unannounced five-minute visit to one classroom.",
          "The inspection team's first impression at the gate.",
          "A single display prepared for visitors.",
        ],
        "Triangulation and representative sampling reduce fragile conclusions."
      ),
      question(
        "pde716-q3",
        "A feedback meeting begins with a final rating and no opportunity to discuss evidence. Which principle is most weakened?",
        "Procedural fairness and evidence-based professional dialogue.",
        [
          "The need to avoid all standards.",
          "The requirement that teachers score themselves.",
          "The rule that observations remain undocumented.",
        ],
        "Transparent evidence and a chance to respond support fair, useful judgments."
      ),
      question(
        "pde716-q4",
        "A report identifies weak formative assessment. Which recommendation is most likely to improve practice?",
        "Specify the practice gap, coaching and modelling support, responsible leader, evidence of change, and review date.",
        [
          "Write 'teachers must improve' without support or follow-up.",
          "Purchase unrelated equipment and close the finding.",
          "Publish individual criticism without a development plan.",
        ],
        "Actionable recommendations connect evidence, support, ownership, and verification."
      ),
      question(
        "pde716-q5",
        "Which distinction between supervision and inspection is most accurate?",
        "Supervision is chiefly developmental and ongoing; inspection provides more independent accountability, though both can inform improvement.",
        [
          "Supervision uses evidence, whereas inspection uses only opinion.",
          "Inspection can never support improvement.",
          "The terms always mean exactly the same process.",
        ],
        "The functions overlap but differ in primary relationship and accountability purpose."
      ),
    ],
  }),
  buildModule({
    code: "PDE 717",
    title: "Educational Technology",
    units: 4,
    week: 5,
    strand: "Digital learning",
    duration: "55 min",
    overview:
      "Select, design, and evaluate technology from learning goals, accessibility, safety, evidence, infrastructure, and total cost—not novelty.",
    outcomes: [
      "Apply pedagogical and accessibility criteria to tool selection.",
      "Design multimedia that manages cognitive load.",
      "Protect privacy, security, and learner welfare.",
      "Plan equitable low-bandwidth and offline alternatives.",
    ],
    keyIdeas: [
      {
        title: "Technology is part of a learning system",
        body:
          "A tool's value depends on the learner action it enables, feedback it provides, teacher practice around it, content quality, and surrounding constraints.",
      },
      {
        title: "Multimedia needs restraint",
        body:
          "Coherence, signalling, segmenting, contiguity, captions, readable contrast, and learner control improve access. Decorative overload consumes attention.",
      },
      {
        title: "Equity and safety are design requirements",
        body:
          "Connectivity, device sharing, disability, language, data cost, privacy, age suitability, vendor security, and support determine who can benefit.",
      },
    ],
    classroomPractice: [
      "Write the learning problem before choosing a tool.",
      "Test a resource with keyboard, captions, contrast, and a small phone.",
      "Provide an equivalent offline path and collect only necessary data.",
    ],
    assessment: [
      question(
        "pde717-q1",
        "A platform adds animation and music to every screen, but learners recall less. Which redesign is most evidence-aligned?",
        "Remove irrelevant media, signal essential structure, segment content, and place related words and visuals together.",
        [
          "Add more decorative motion to increase stimulation.",
          "Play two narrations simultaneously.",
          "Hide playback controls from learners.",
        ],
        "Coherence, signalling, segmenting, and contiguity reduce extraneous load."
      ),
      question(
        "pde717-q2",
        "Which procurement question should come before asking whether a tool uses artificial intelligence?",
        "What learning action and evidence will the tool improve for these learners under our actual constraints?",
        [
          "How many fashionable features appear on the homepage?",
          "Can the vendor replace every teacher immediately?",
          "Will novelty guarantee motivation indefinitely?",
        ],
        "Pedagogical purpose and context precede feature appeal."
      ),
      question(
        "pde717-q3",
        "A reading app requires continuous video, modern phones, and large data bundles. Most families share basic devices. What is the core implementation flaw?",
        "The access model creates predictable exclusion and lacks an equivalent low-bandwidth pathway.",
        [
          "The app contains digital text.",
          "Families are solely responsible for system design.",
          "Equity should be reviewed only after final examinations.",
        ],
        "Infrastructure and cost are part of instructional feasibility and fairness."
      ),
      question(
        "pde717-q4",
        "A free quiz tool collects learners' full names, contacts, location, and advertising identifiers although only anonymous responses are needed. Which principle applies?",
        "Data minimisation: collect and retain only what the learning purpose requires.",
        [
          "More data is always safer because storage is cheap.",
          "Free tools are exempt from privacy duties.",
          "Parental awareness permits unlimited secondary use.",
        ],
        "Necessary, proportionate collection reduces privacy and security risk."
      ),
      question(
        "pde717-q5",
        "Which evaluation best tests whether a new tool improves learning rather than merely attracts clicks?",
        "Compare aligned learning evidence and participation quality, examine subgroup access, and document implementation conditions.",
        [
          "Count logins without examining what learners did.",
          "Use the vendor's slogan as the outcome measure.",
          "Ask only the teacher who purchased the tool.",
        ],
        "Learning, implementation, and equity evidence are needed to judge educational value."
      ),
    ],
  }),
  buildModule({
    code: "PDE 718",
    title: "Practical Teaching",
    units: 4,
    week: 5,
    strand: "Professional practice",
    duration: "60 min",
    overview:
      "Integrate planning, explanation, relationships, routines, assessment, inclusion, reflection, and professional responsibility in real classroom conditions.",
    outcomes: [
      "Plan coherent lessons responsive to actual learners.",
      "Establish safe, efficient routines and ambitious participation.",
      "Adapt from evidence during and after teaching.",
      "Use observation and reflection to improve specific practice.",
    ],
    keyIdeas: [
      {
        title: "Planning is a prediction",
        body:
          "A lesson plan anticipates learner starting points, misconceptions, representations, questions, evidence, support, pacing, and contingencies.",
      },
      {
        title: "Management protects learning",
        body:
          "Clear expectations, taught routines, active supervision, relevant work, calm correction, and restorative follow-up create time and safety for learning.",
      },
      {
        title: "Reflection needs evidence",
        body:
          "Professional reflection compares intended and observed learning, explains likely causes cautiously, and commits to a testable next move.",
      },
    ],
    classroomPractice: [
      "Plan what each likely response will cause you to do next.",
      "Teach routines explicitly before correcting failures.",
      "Reflect from learner work and participation evidence, not feeling alone.",
    ],
    assessment: [
      question(
        "pde718-q1",
        "Half the class answers a hinge question with the same misconception. The next planned task assumes mastery. What should the teacher do?",
        "Change course: surface the reasoning, reteach with a contrasting representation, and recheck before advancing.",
        [
          "Continue to protect the written plan.",
          "Lower final scores without further teaching.",
          "Ask only the one learner who answered correctly.",
        ],
        "Responsive teaching uses evidence to modify instruction."
      ),
      question(
        "pde718-q2",
        "A transition repeatedly becomes noisy because materials are collected one at a time with no assigned routine. Which response is most effective?",
        "Redesign, model, rehearse, and reinforce an efficient materials routine.",
        [
          "Increase punishment while preserving the confusing procedure.",
          "Assume the class lacks character.",
          "Remove every collaborative activity permanently.",
        ],
        "Many management problems are design and routine problems before they are motivation problems."
      ),
      question(
        "pde718-q3",
        "Which reflection is most professionally useful?",
        "Only 6 of 24 learners justified the inference; next lesson I will model one example, compare two non-examples, then sample every learner.",
        [
          "The lesson felt fine.",
          "The learners were bad today.",
          "I covered all slides, so learning occurred.",
        ],
        "Specific evidence and a testable next action make reflection productive."
      ),
      question(
        "pde718-q4",
        "A learner needs text-to-speech to access the same history reasoning task. Which interpretation is strongest?",
        "The support changes access to text while preserving the intended historical construct.",
        [
          "Any support automatically lowers the learning standard.",
          "The learner should receive a different objective without review.",
          "Access needs are identical to lack of effort.",
        ],
        "An accommodation can remove an irrelevant barrier while maintaining the target."
      ),
      question(
        "pde718-q5",
        "What is the strongest evidence that an explanation was effective?",
        "Learners can use the idea accurately, explain why it applies, and distinguish a tempting non-example.",
        [
          "The teacher spoke without pausing.",
          "The board contained complete notes.",
          "The class remained silent throughout.",
        ],
        "Teaching quality is inferred from learner understanding, not delivery features alone."
      ),
    ],
  }),
  buildModule({
    code: "PDE 719",
    title: "Project Work",
    units: 4,
    week: 5,
    strand: "Inquiry",
    duration: "55 min",
    overview:
      "Plan and deliver an educational project with a defensible problem, ethical evidence, realistic scope, transparent process, critical analysis, and useful communication.",
    outcomes: [
      "Define a feasible problem and purpose.",
      "Build a coherent proposal from question to analysis.",
      "Manage evidence, milestones, risks, and authorship ethically.",
      "Defend conclusions in proportion to the evidence.",
    ],
    keyIdeas: [
      {
        title: "A project solves a bounded problem",
        body:
          "Strong projects narrow population, setting, time, variables or phenomenon, and intended contribution. Ambition without feasibility weakens completion and credibility.",
      },
      {
        title: "Coherence is visible",
        body:
          "Problem, literature, conceptual frame, questions, methods, evidence, analysis, findings, and recommendations should form a traceable line.",
      },
      {
        title: "Process is part of quality",
        body:
          "Milestones, version control, source records, consent, secure data, supervision notes, and risk responses make the work auditable and manageable.",
      },
    ],
    classroomPractice: [
      "Write the project question in one bounded sentence.",
      "Maintain a decision log and source trail.",
      "State limitations before making recommendations.",
    ],
    assessment: [
      question(
        "pde719-q1",
        "A project proposes to 'solve poor education in Nigeria' in four weeks. What is the most important revision?",
        "Bound the setting, population, problem, evidence, and feasible contribution.",
        [
          "Add more broad objectives without changing scope.",
          "Remove all timelines so the ambition remains unlimited.",
          "Begin data collection before deciding the question.",
        ],
        "Feasible scope is essential to coherent design and credible completion."
      ),
      question(
        "pde719-q2",
        "The literature review discusses motivation, the question asks about attendance, and the instrument measures satisfaction. What is the core weakness?",
        "The project lacks conceptual and methodological alignment across its components.",
        [
          "Every project must use three unrelated constructs.",
          "Literature reviews should never inform questions.",
          "Satisfaction is identical to attendance.",
        ],
        "A strong project maintains a traceable line from problem to evidence."
      ),
      question(
        "pde719-q3",
        "Which practice best protects academic authorship when using another scholar's framework?",
        "Cite the original source, distinguish borrowed ideas from adaptations, and document the project's own contribution.",
        [
          "Change a few words and omit the citation.",
          "Cite only sources that agree with the findings.",
          "List the source without indicating where it was used.",
        ],
        "Attribution and transparent adaptation protect intellectual integrity."
      ),
      question(
        "pde719-q4",
        "A project finds improvement in one volunteer class with no comparison group. Which recommendation is proportionate?",
        "Treat the result as promising local evidence and propose further testing before broad adoption.",
        [
          "Mandate the approach nationally as proven.",
          "Claim volunteer selection cannot affect results.",
          "Generalise to every age and subject without qualification.",
        ],
        "Recommendations should reflect design strength, context, and uncertainty."
      ),
      question(
        "pde719-q5",
        "Why is a project decision log valuable?",
        "It records changes, reasons, evidence, and consequences, improving transparency and supervision.",
        [
          "It replaces the need for data analysis.",
          "It guarantees every decision was correct.",
          "It permits sources to remain undocumented.",
        ],
        "A decision trail makes the process auditable and supports justified adaptation."
      ),
    ],
  }),
  buildModule({
    code: "PDE 720",
    title: "Comparative Education",
    units: 2,
    week: 5,
    strand: "Systems thinking",
    duration: "45 min",
    overview:
      "Compare education systems with disciplined attention to history, culture, governance, finance, demography, policy enactment, and the limits of transferring reforms.",
    outcomes: [
      "Choose comparable units and indicators.",
      "Distinguish policy text from policy enactment.",
      "Explain outcomes through interacting contexts.",
      "Evaluate policy borrowing for functional and cultural fit.",
    ],
    keyIdeas: [
      {
        title: "Comparison needs a frame",
        body:
          "Countries are not naturally equivalent units. Researchers define the level, period, population, concepts, indicators, and sources before drawing comparisons.",
      },
      {
        title: "Systems are historically embedded",
        body:
          "Governance, teacher labour, language, examinations, welfare, migration, inequality, and public trust shape how similar policies function.",
      },
      {
        title: "Borrowing requires translation",
        body:
          "A visible policy feature may depend on less visible financing, capacity, incentives, culture, and institutional relationships. Adaptation begins with the problem, not the prestige of the source.",
      },
    ],
    classroomPractice: [
      "Define equivalent indicators before comparing rankings.",
      "Compare implementation conditions, not policy labels alone.",
      "Name what must be adapted, built, or protected before transfer.",
    ],
    assessment: [
      question(
        "pde720-q1",
        "Country A reports 98% completion at age 15; Country B reports 90% at the end of lower secondary, usually age 16. What must occur before ranking them?",
        "Establish whether definitions, age cohorts, pathways, data quality, and reference periods are comparable.",
        [
          "Treat both percentages as automatically equivalent.",
          "Choose the larger country as more successful.",
          "Ignore how completion is defined.",
        ],
        "Comparable labels can conceal different denominators, structures, and measurement."
      ),
      question(
        "pde720-q2",
        "A high-performing system has short school days, so another country copies only the timetable and outcomes do not improve. What was overlooked?",
        "The timetable was separated from curriculum coherence, teacher capacity, welfare, culture, and out-of-school conditions.",
        [
          "Visible policy features always transfer independently.",
          "High-performing systems cannot be studied.",
          "School-day length is the sole cause of achievement.",
        ],
        "Policy features work within interacting institutional systems."
      ),
      question(
        "pde720-q3",
        "Which comparison most directly examines policy enactment?",
        "Study how the same inclusion policy is interpreted, resourced, and practised across selected schools.",
        [
          "Compare only the titles of national policy documents.",
          "Count how often the word inclusion appears in a law.",
          "Assume adoption means identical classroom implementation.",
        ],
        "Enactment concerns how actors translate policy under real conditions."
      ),
      question(
        "pde720-q4",
        "A league table score rises while exclusion of low-performing learners also rises. What does this show?",
        "System performance indicators must be interpreted with participation, equity, and incentive effects.",
        [
          "The score alone proves universal improvement.",
          "Exclusion cannot influence system averages.",
          "Equity measures are unrelated to comparative education.",
        ],
        "Indicators can improve through changes in who is counted rather than what learners experience."
      ),
      question(
        "pde720-q5",
        "Which question should lead responsible policy borrowing?",
        "What local problem are we solving, which mechanism matters, and what conditions are required for that mechanism here?",
        [
          "Which foreign policy has the most attractive name?",
          "How can the source system be copied without adaptation?",
          "Which contextual differences can be ignored?",
        ],
        "Mechanism, problem fit, and local conditions guide responsible adaptation."
      ),
    ],
  }),
  buildModule({
    code: "PDE 721",
    title: "Adult and Non-Formal Education",
    units: 2,
    week: 5,
    strand: "Inclusive learning",
    duration: "45 min",
    overview:
      "Design flexible, relevant, participatory learning for adults and out-of-school communities by respecting experience, agency, livelihood, language, access, and practical transfer.",
    outcomes: [
      "Distinguish formal, non-formal, and informal learning.",
      "Conduct participatory needs analysis.",
      "Design around adult roles, barriers, and experience.",
      "Evaluate participation, capability, transfer, and empowerment.",
    ],
    keyIdeas: [
      {
        title: "Adults bring resources and constraints",
        body:
          "Experience, identity, work, family roles, prior schooling, goals, dignity, time, transport, language, disability, and opportunity costs shape participation.",
      },
      {
        title: "Relevance is co-constructed",
        body:
          "Participatory needs analysis identifies valued problems and existing knowledge. Programmes connect literacy, numeracy, health, livelihood, citizenship, and local action where appropriate.",
      },
      {
        title: "Flexibility does not mean low quality",
        body:
          "Non-formal programmes can use flexible schedules, locations, pacing, facilitators, recognition, and pathways while maintaining clear outcomes and credible evidence.",
      },
    ],
    classroomPractice: [
      "Schedule with participants rather than for them.",
      "Begin from authentic tasks and familiar language resources.",
      "Measure use of learning in daily life as well as attendance.",
    ],
    assessment: [
      question(
        "pde721-q1",
        "A literacy programme meets during peak market hours and describes low attendance as lack of motivation. What is the best diagnosis?",
        "The programme ignored opportunity costs and participant context in its design.",
        [
          "Adults are incapable of sustained learning.",
          "Attendance can only be changed through punishment.",
          "Scheduling is unrelated to access.",
        ],
        "Adult participation depends on how learning fits real responsibilities and constraints."
      ),
      question(
        "pde721-q2",
        "Which feature most clearly distinguishes non-formal education from informal learning?",
        "Non-formal education is intentionally organised around learning aims outside the conventional formal system.",
        [
          "Non-formal learning is always unplanned and accidental.",
          "Informal learning always awards national certificates.",
          "Formal education has no curriculum.",
        ],
        "Non-formal provision is organised and purposeful, while informal learning arises through everyday activity."
      ),
      question(
        "pde721-q3",
        "What is the strongest first step in a community numeracy programme?",
        "Co-investigate the calculations participants need, existing strategies, barriers, language, and preferred participation conditions.",
        [
          "Import a fixed textbook without consultation.",
          "Assume all adults have identical goals.",
          "Begin with a high-stakes examination.",
        ],
        "Participatory needs analysis grounds relevance and respects existing capability."
      ),
      question(
        "pde721-q4",
        "Attendance is high, but participants still cannot apply budgeting skills at home. Which evaluation conclusion is strongest?",
        "Reach was good, but capability transfer is weak and the learning design needs investigation.",
        [
          "Attendance alone proves full programme impact.",
          "Home application is outside educational evaluation.",
          "The programme should report only enrolment.",
        ],
        "Participation is an output; practical transfer is a distinct outcome."
      ),
      question(
        "pde721-q5",
        "Which facilitation approach best respects adult experience without treating all prior beliefs as correct?",
        "Elicit experience as evidence, compare it with alternatives, test claims, and build usable understanding collaboratively.",
        [
          "Ignore experience because only the facilitator has knowledge.",
          "Accept every claim without examination.",
          "Avoid feedback to preserve dignity.",
        ],
        "Respect involves taking experience seriously while maintaining inquiry and evidence."
      ),
    ],
  }),
  buildModule({
    code: "PDE 722",
    title: "Internship",
    units: 2,
    week: 5,
    strand: "Professional practice",
    duration: "50 min",
    overview:
      "Turn workplace participation into accountable professional learning through goals, ethical conduct, evidence, supervision, reflection, feedback, and contribution.",
    outcomes: [
      "Set role-relevant learning goals and success evidence.",
      "Work within policy, competence, confidentiality, and supervision.",
      "Seek, test, and document feedback.",
      "Build a portfolio that demonstrates growth rather than activity alone.",
    ],
    keyIdeas: [
      {
        title: "Experience needs structure",
        body:
          "Hours in a workplace do not guarantee learning. Goals, observation, increasing responsibility, feedback, reflection, and evidence convert participation into development.",
      },
      {
        title: "Professional boundaries travel with the role",
        body:
          "Interns protect confidentiality, follow safeguarding and safety rules, disclose limits, seek approval, and do not independently perform work beyond competence.",
      },
      {
        title: "Evidence shows contribution and growth",
        body:
          "A portfolio links artefacts to standards, context, decisions, feedback, revision, outcomes, and next steps while removing unnecessary personal data.",
      },
    ],
    classroomPractice: [
      "Agree goals, permitted responsibilities, and escalation routes on day one.",
      "Request feedback on one observable practice each week.",
      "Annotate portfolio evidence with what changed and why.",
    ],
    assessment: [
      question(
        "pde722-q1",
        "An intern completes 120 hours of routine photocopying with no goals, observation, or feedback. What is the central quality problem?",
        "Time was accumulated without a structured pathway to professional learning and evidence.",
        [
          "Photocopying can never support any workplace.",
          "Internships require no supervision.",
          "Hours alone demonstrate every professional standard.",
        ],
        "Duration is not equivalent to deliberate, supported learning."
      ),
      question(
        "pde722-q2",
        "A supervisor asks an intern to counsel a high-risk learner alone beyond the intern's competence. What should the intern do?",
        "Explain the limit, maintain immediate safety, and escalate to an authorised competent professional.",
        [
          "Proceed silently because the supervisor requested it.",
          "Post the case online to ask strangers for advice.",
          "Abandon the learner without arranging support.",
        ],
        "Professional responsibility includes recognising limits and using supervision and safeguarding routes."
      ),
      question(
        "pde722-q3",
        "Which portfolio annotation best demonstrates reflective growth?",
        "After feedback showed my questions sampled volunteers only, I used response cards; the next observation captured every learner and changed my grouping.",
        [
          "I attended on Tuesday.",
          "The lesson plan is attached.",
          "My supervisor said I did well.",
        ],
        "Strong evidence links feedback, changed practice, and learner-relevant consequences."
      ),
      question(
        "pde722-q4",
        "An intern includes identifiable learner records in a personal portfolio. What is the best correction?",
        "Remove or de-identify unnecessary data and retain only authorised evidence handled under school policy.",
        [
          "Keep the records because assessment overrides privacy.",
          "Add more identifiers to prove authenticity.",
          "Share the portfolio publicly for feedback.",
        ],
        "Portfolio evidence must respect confidentiality, authorisation, and data minimisation."
      ),
      question(
        "pde722-q5",
        "Which supervision pattern best supports increasing professional responsibility?",
        "Model and observe first, then grant bounded independence as evidence of competence grows, with continued review.",
        [
          "Give full unsupervised responsibility on the first day.",
          "Prevent the intern from attempting any meaningful task.",
          "Base responsibility on confidence alone.",
        ],
        "Gradual release links autonomy to observed competence and appropriate oversight."
      ),
    ],
  }),
];

const MODULE_BY_CODE = new Map(MODULES.map((module) => [module.code, module]));
const QUESTION_BY_ID = new Map(
  MODULES.flatMap((module) =>
    module.assessment.map((entry) => [entry.id, { ...entry, moduleCode: module.code }])
  )
);

const getModuleByCode = (code = "") =>
  MODULE_BY_CODE.get(String(code || "").trim().toUpperCase()) || null;

const getQuestionById = (id = "") => QUESTION_BY_ID.get(String(id || "").trim()) || null;

const serializeModuleContent = (module) => ({
  code: module.code,
  title: module.title,
  units: module.units,
  week: module.week,
  strand: module.strand,
  duration: module.duration,
  overview: module.overview,
  outcomes: module.outcomes,
  keyIdeas: module.keyIdeas,
  classroomPractice: module.classroomPractice,
  questionCount: module.assessment.length,
});

module.exports = {
  MODULES,
  MODULE_BY_CODE,
  PASS_MARK_PERCENT,
  QUESTIONS_PER_MODULE,
  QUESTION_TIME_LIMIT_SECONDS,
  getModuleByCode,
  getQuestionById,
  serializeModuleContent,
};
