const revision = (readingFocus, prompt, correct, distractors, explanation) => ({
  readingFocus,
  prompt,
  options: [correct, ...distractors],
  correctIndex: 0,
  explanation,
  revisedForExpandedReading: true,
});

const QUESTION_REVISIONS = {
  "pde701-q1": revision(
    "Learning traditions and the purposes they served",
    "Learners compare an elder's account of apprenticeship with tools, language evidence, and a colonial record written by an outsider. Why is this combination historically stronger than using the colonial record alone?",
    "It corroborates different forms of evidence and exposes how each source's position may shape what it records.",
    [
      "Oral evidence is automatically accurate whenever it comes from an elder.",
      "Artefacts establish the motives of every participant without interpretation.",
      "Written records should be rejected whenever another source disagrees with them.",
    ],
    "Historical claims become more defensible when sources are contextualised and corroborated rather than ranked only by whether they are written."
  ),
  "pde701-q5": revision(
    "Reform, continuity, and historical thinking in today's classroom",
    "A reform doubles enrolment but leaves large regional gaps, weak attendance, and little evidence of learning. Which historical judgment is best supported?",
    "It expanded access by one measure, but its implementation and longer-term equity and learning outcomes remain mixed.",
    [
      "The reform completely succeeded because enrolment is the only valid outcome.",
      "The reform completely failed because no policy can produce uneven results.",
      "The evidence proves that historical context no longer affects implementation.",
    ],
    "Reforms should be evaluated against stated aims, implementation conditions, affected groups, and more than one outcome."
  ),
  "pde702-q1": revision(
    "Development across connected domains",
    "A learner explains a market calculation accurately in a home language but struggles to write the same reasoning in formal English. What should the teacher infer first?",
    "Conceptual reasoning may be stronger than the academic-language performance currently reveals, so both should be assessed and supported.",
    [
      "The learner has no mathematical understanding because the written response is weak.",
      "Home-language performance should replace every academic-language expectation permanently.",
      "Different performance across contexts proves that developmental evidence is useless.",
    ],
    "Development and performance are multidimensional and context-sensitive; an unrelated language barrier can conceal emerging competence."
  ),
  "pde702-q5": revision(
    "Scaffolding learning that is within reach",
    "After several supported examples, a learner succeeds only while viewing a complete model. Which next move best tests and develops independence?",
    "Remove selected steps from the model, prompt the learner to complete them, and check the strategy on a new example.",
    [
      "Continue supplying the complete solution indefinitely because supported success proves mastery.",
      "Remove every support at once and treat any error as lack of ability.",
      "Change the learning objective so independent use is never expected.",
    ],
    "Scaffolds should reveal task structure and then fade in response to evidence so that support develops rather than replaces independence."
  ),
  "pde703-q1": revision(
    "Beginning with alignment and evidence",
    "A unit aims for learners to defend a solution using evidence. Lessons provide explanations and practice, but the final task is twenty multiple-choice definitions. What should be redesigned first?",
    "The final task should require the intended defence and use of evidence, with criteria matching that performance.",
    [
      "The objective should be lowered to remembering definitions because the test is already written.",
      "More unrelated group activities should be added without changing the assessment.",
      "The criteria should remain hidden so the assessment feels more challenging.",
    ],
    "Constructive alignment requires objectives, assessment evidence, activities, and feedback to address the same level of performance."
  ),
  "pde703-q5": revision(
    "Using formative evidence to adapt teaching",
    "An exit response shows that most learners can state a rule but cannot decide when it applies. Which next lesson is the strongest response?",
    "Compare varied examples and non-examples, require learners to justify the rule's use, and check every learner again.",
    [
      "Repeat the rule for the same amount of time and collect no new evidence.",
      "Move on because stating the rule proves transfer.",
      "Convert the exit response into a high-stakes grade without further instruction.",
    ],
    "Formative evidence should identify the learning gap and cause a targeted, observable change in the next teaching opportunity."
  ),
  "pde704-q1": revision(
    "Seeing the curriculum beyond the syllabus",
    "A school's written curriculum promotes respectful debate, but routines consistently punish questioning and reward silent agreement. Which curriculum layer most directly communicates the conflicting lesson?",
    "The hidden curriculum conveyed by everyday routines and authority relationships.",
    [
      "The intended curriculum because every written aim is automatically enacted.",
      "The null curriculum because respectful debate appears in the document.",
      "The learned curriculum because all learners must interpret the routine identically.",
    ],
    "Implicit institutional routines can teach values that compete with the stated curriculum."
  ),
  "pde704-q5": revision(
    "Developing, implementing, and revising curriculum",
    "A pilot curriculum produces good work in well-equipped schools but low participation elsewhere. What is the most useful revision process?",
    "Compare implementation, resources, teacher experience, learner work, and group access, then revise the design and support conditions.",
    [
      "Scale immediately because one setting produced strong work.",
      "Discard all learner evidence and rewrite only the curriculum title.",
      "Require identical implementation while refusing to examine unequal conditions.",
    ],
    "Curriculum evaluation asks what worked, for whom, under what conditions, and what implementation support must change."
  ),
  "pde705-q1": revision(
    "Defining the construct before writing questions",
    "A teacher wants to assess scientific argument but writes a test blueprint containing only vocabulary recall. What is the central threat?",
    "The planned evidence underrepresents the reasoning construct the score is meant to describe.",
    [
      "A blueprint makes every assessment too reliable.",
      "Vocabulary can never contribute to a scientific argument.",
      "The assessment contains too many ways to demonstrate reasoning.",
    ],
    "A blueprint protects alignment only when its content and cognitive demands adequately represent the intended construct."
  ),
  "pde705-q5": revision(
    "Interpreting results and making proportionate decisions",
    "A two-question exit ticket identifies a possible misconception. Which use is proportionate to that evidence?",
    "Use it to plan a follow-up check and targeted reteaching, not as the sole basis for permanent placement.",
    [
      "Assign a permanent ability label because every score is exact.",
      "Ignore it because low-stakes evidence cannot inform teaching.",
      "Publish individual results so families can compare learners.",
    ],
    "The consequence of a decision should match the relevance, breadth, reliability, and corroboration of the evidence."
  ),
  "pde706-q1": revision(
    "Attention, working memory, and prior knowledge",
    "Novices must alternate between a dense diagram on one page and unexplained instructions on another. Which redesign best reduces irrelevant cognitive load?",
    "Place connected explanations beside the relevant diagram parts, signal the sequence, and model the first example.",
    [
      "Add decorative animation and background music to increase stimulation.",
      "Remove the diagram and require memorisation of every instruction.",
      "Present all later examples at the same time before explaining the first.",
    ],
    "Integrating connected information and signalling structure frees limited working memory for the intended concept."
  ),
  "pde706-q5": revision(
    "Motivation, belonging, and productive challenge",
    "A capable learner avoids public problem-solving after classmates mocked an earlier error. What should the teacher address before concluding that the learner lacks motivation?",
    "The social cost and sense of belonging, while restoring safe participation and maintaining meaningful challenge.",
    [
      "The learner's fixed personality, because context cannot influence motivation.",
      "Only the size of an external reward for volunteering.",
      "Whether the learning standard can be removed for the whole class.",
    ],
    "Motivation reflects expectancy, value, cost, and belonging; avoidance may be a rational response to an unsafe participation structure."
  ),
  "pde707-q1": revision(
    "Building and testing educational arguments",
    "A principal argues, 'Most parents prefer strict discipline; therefore every strict rule is educationally justified.' What is missing?",
    "A value premise and reasons showing that each restriction is proportionate, educationally relevant, and consistent with competing rights.",
    [
      "A larger popularity poll, because majority preference automatically establishes what ought to be done.",
      "A claim that descriptive evidence can never appear in a normative argument.",
      "A promise that rules will never be reviewed once adopted.",
    ],
    "Facts about preference do not alone establish a normative conclusion; educational authority still requires defensible reasons."
  ),
  "pde707-q5": revision(
    "Judging tensions with consistency and care",
    "Which school rule best reconciles learner freedom with the community's need for safety?",
    "A clearly explained, narrowly tailored restriction that is applied consistently and reviewed when evidence or circumstances change.",
    [
      "An unlimited restriction justified only by the phrase 'because we said so.'",
      "No shared boundary, even when one learner's action creates a serious risk to others.",
      "A secret rule applied differently according to staff preference.",
    ],
    "Legitimate authority is transparent, proportionate, connected to a defensible purpose, and open to reasoned review."
  ),
  "pde708-q1": revision(
    "From a problem of practice to an answerable question",
    "A researcher asks how new teachers experience inspection feedback but chooses only a closed attendance checklist. What is the primary design problem?",
    "The measure cannot capture the meaning and experience required by the interpretive question.",
    [
      "Every research question must use a checklist.",
      "Experience can be studied only through national examination data.",
      "The sample is invalid solely because the participants are teachers.",
    ],
    "Questions, samples, measures, procedures, and analysis must align with the kind of claim the study intends to make."
  ),
  "pde708-q5": revision(
    "Ethics, power, and responsible communication",
    "A report describes critical comments from three named staff members in a small school. What is the most responsible revision?",
    "Remove direct and indirect identifiers, explain any remaining disclosure risk, and report the finding without exposing participants to retaliation.",
    [
      "Keep the names because signed consent removes every later ethical duty.",
      "Add job titles and personal details to make the quotations more vivid.",
      "Suppress all findings, including safely reportable aggregate patterns.",
    ],
    "Confidentiality requires attention to indirect identification and foreseeable consequences during dissemination, not only during collection."
  ),
  "pde709-q1": revision(
    "Schooling as both opportunity and social institution",
    "A school increases literacy and civic participation while advanced credentials remain concentrated among affluent learners. Which interpretation is strongest?",
    "Functional and conflict perspectives illuminate different, simultaneous consequences of the same institution.",
    [
      "Only one consequence can be real because sociological lenses cannot coexist.",
      "Improved literacy proves that credential inequality is irrelevant.",
      "Unequal credentials prove that schools never provide any public benefit.",
    ],
    "Multiple sociological lenses can explain how schooling expands shared capability while also distributing valued opportunity unequally."
  ),
  "pde709-q5": revision(
    "Expectations, grouping, and more equitable pathways",
    "Which grouping policy best limits a self-fulfilling low-track pathway?",
    "Use recent task-specific evidence, maintain rich instruction, review placement often, and publish a clear route for movement.",
    [
      "Make groups permanent after one narrow test.",
      "Give the lowest group simpler work and no opportunity to demonstrate growth.",
      "Hide the grouping criteria so expectations cannot be questioned.",
    ],
    "Flexible, evidence-based grouping can address a current need without turning an initial judgment into unequal long-term opportunity."
  ),
  "pde710-q1": revision(
    "Describing educational data before drawing conclusions",
    "Two schools each report 12 absences, but one enrols 30 learners and the other 300. What must be calculated before comparing the scale of absence?",
    "A rate or proportion using the relevant enrolment and time denominator for each school.",
    [
      "The combined number of desks, regardless of attendance records.",
      "Only the larger of the two raw absence counts.",
      "A mean of the two school names converted into numbers.",
    ],
    "Raw counts require meaningful denominators before the relative scale of an outcome can be compared."
  ),
  "pde710-q5": revision(
    "Sampling, uncertainty, and inference",
    "A voluntary online survey excludes most schools without connectivity but produces a very narrow confidence interval. Which conclusion is correct?",
    "The estimate may be precise for the biased responding sample while still poorly representing the target population.",
    [
      "A narrow interval automatically repairs coverage and nonresponse bias.",
      "Connectivity cannot be related to any educational outcome.",
      "Confidence intervals are valid only when every population member responds.",
    ],
    "Sampling intervals quantify random uncertainty under assumptions; they do not eliminate systematic exclusion from the sampling process."
  ),
  "pde711-q1": revision(
    "Reducing teaching complexity to practise deliberately",
    "A trainee wants to improve 'classroom teaching' in an eight-minute micro-lesson. Which target is most suitable?",
    "Elicit a response from every learner with one hinge question and adapt the next explanation to the pattern.",
    [
      "Improve planning, voice, discipline, assessment, inclusion, content, and confidence simultaneously.",
      "Complete the entire term's scheme of work during the rehearsal.",
      "Receive an overall personality rating without observing learner responses.",
    ],
    "Micro-teaching makes deliberate practice possible by narrowing the skill, setting, duration, and evidence."
  ),
  "pde711-q5": revision(
    "Reteaching, comparing evidence, and transferring the skill",
    "A revised questioning routine works with four peers in rehearsal. What is the best next step before treating it as established classroom practice?",
    "Plan its use in a real class, anticipate contextual demands, collect aligned learner evidence, and refine it again.",
    [
      "Assume transfer is automatic because the micro-lesson improved.",
      "Use the routine in every subject without examining its purpose.",
      "Discard the observation target so full-class evidence cannot be compared.",
    ],
    "Transfer requires deliberate adaptation and evidence because a full classroom reintroduces complexity removed during rehearsal."
  ),
  "pde712-q1": revision(
    "The teacher's helping role and basic counselling skills",
    "A distressed learner begins describing a problem, and the teacher immediately lists solutions before clarifying the learner's concern. What is the better first move?",
    "Listen, reflect and summarise the concern, clarify the teacher's role, and help the learner identify a manageable next step.",
    [
      "Choose the learner's decision so the conversation ends quickly.",
      "Promise absolute secrecy before asking whether anyone is unsafe.",
      "Demand every private detail even when it is unrelated to support.",
    ],
    "Helping should build understanding and agency before advice, while keeping role and safeguarding responsibilities explicit."
  ),
  "pde712-q5": revision(
    "Boundaries, referral, and sustained support",
    "A teacher refers a learner to an authorised service. Which follow-up is professionally appropriate?",
    "Confirm whether access occurred and adjust relevant classroom support without demanding confidential counselling details.",
    [
      "Assume the referral ended every school responsibility.",
      "Ask the learner to report the counsellor's private notes to the class teacher.",
      "Discuss the referral informally with staff who have no support role.",
    ],
    "Referral is an active handover, and school support continues while private information remains limited to what is necessary."
  ),
  "pde713-q1": revision(
    "Planning from diagnosis to measurable action",
    "A plan funds new textbooks to improve reading but never examines language, distribution, attendance, or how teachers will use them. What is missing?",
    "A defensible theory of action linking the resource to the diagnosed causes, implementation steps, and evidence of learning.",
    [
      "A promise that purchasing an input automatically produces an outcome.",
      "More activities without owners, milestones, or baseline evidence.",
      "A target that avoids identifying the learners or timeframe.",
    ],
    "Planning must explain why an activity addresses the diagnosed constraint and how implementation and outcomes will be monitored."
  ),
  "pde713-q5": revision(
    "Resource allocation and transparent trade-offs",
    "A low-cost device proposal omits licensing, teacher preparation, maintenance, replacement, and connectivity. Which judgment is strongest?",
    "Its full recurrent cost and implementation conditions must be compared with alternatives before it can be called economical.",
    [
      "The purchase price is the only cost relevant to educational planning.",
      "Maintenance can be excluded because it occurs after approval.",
      "The visible option should be selected regardless of opportunity cost.",
    ],
    "Transparent allocation considers total cost, feasibility, educational benefit, equity, risk, and what other priority the choice displaces."
  ),
  "pde714-q1": revision(
    "Structuring a purposeful helping conversation",
    "Which opening best prepares a learner for a time-limited counselling conversation with a trained educator?",
    "Explain the purpose, available time, role, privacy and its safety limits, then invite the learner's account with an open question.",
    [
      "Begin with a diagnosis and a fixed solution before hearing the concern.",
      "Promise that nothing will ever be shared under any circumstance.",
      "Avoid explaining the process so the learner cannot influence it.",
    ],
    "A clear opening supports informed trust, realistic expectations, and learner participation in the helping process."
  ),
  "pde714-q5": revision(
    "Referral, crisis response, and continuity of care",
    "A non-emergency referral repeatedly fails because transport and fees prevent access. What is the most responsible response?",
    "Review the barrier with the learner, identify an authorised feasible alternative, make a warm handover, and agree another follow-up date.",
    [
      "Record non-compliance and end support without asking why access failed.",
      "Request private therapy details from an unrelated service.",
      "Publish the learner's difficulty so community members can intervene informally.",
    ],
    "Continuity of care includes addressing practical barriers and confirming connection rather than treating referral as a one-time instruction."
  ),
  "pde715-q1": revision(
    "Teaching English through purposeful language use",
    "Learners can identify a persuasive technique but cannot explain its effect in a real text. Which task best advances the intended understanding?",
    "Compare two short passages, cite the language choice in each, and explain how it shapes meaning for its audience.",
    [
      "Copy the technique's definition repeatedly without reading a passage.",
      "Memorise a list of authors unrelated to the learning objective.",
      "Remove discussion and revision so first responses become final.",
    ],
    "English learning should connect language knowledge to purposeful interpretation, evidence, communication, and revision."
  ),
  "pde715-q5": revision(
    "Teaching Social Studies and ICT through critical inquiry",
    "Learners are creating a digital explanation of a local civic issue. Which design best integrates subject learning and digital responsibility?",
    "Require sourced claims, comparison of perspectives, privacy-safe media, accessible presentation, and an explanation of digital choices.",
    [
      "Grade only the number of animations in the presentation.",
      "Allow personal data and copied media because the project is educational.",
      "Treat the first search result as neutral evidence and omit citations.",
    ],
    "Meaningful integration preserves disciplinary inquiry while making credibility, creation, accessibility, privacy, and copyright explicit."
  ),
  "pde716-q1": revision(
    "Distinguishing supervision from inspection",
    "A leader invites a teacher to a developmental coaching observation, then secretly uses it as the sole basis for a compliance sanction. What is the central problem?",
    "The purpose, criteria, power relationship, and use of evidence were misrepresented, undermining fairness and trust.",
    [
      "Developmental supervision can never include evidence.",
      "Inspection findings never require transparent criteria.",
      "Any observed lesson provides complete evidence of routine practice.",
    ],
    "Supervision and inspection may examine related evidence, but their purposes and consequences must be explained honestly."
  ),
  "pde716-q5": revision(
    "Feedback, action planning, and follow-up",
    "Which action plan is most likely to turn an observation finding into improvement?",
    "Name one priority, responsible people, support, deadline, learner evidence, and a follow-up review of the changed practice.",
    [
      "File a broad judgment with no support or review date.",
      "Require extra paperwork unrelated to the observed learning issue.",
      "Replace descriptive evidence with the observer's personality preference.",
    ],
    "Follow-up connects evidence and feedback to supported action and checks whether learner experience actually improves."
  ),
  "pde717-q1": revision(
    "Choosing technology from the learning problem",
    "A school has unreliable connectivity and needs learners to rehearse pronunciation with feedback. Which selection principle is strongest?",
    "Choose the simplest accessible recording and playback route that meets the goal, with an offline alternative and support plan.",
    [
      "Select the newest streaming platform regardless of access or learning fit.",
      "Buy a complex system before defining what learner evidence it should produce.",
      "Assume device ownership guarantees data, electricity, privacy, and confidence.",
    ],
    "Technology should be selected from the learning problem, actual infrastructure, access needs, reliability, and total implementation conditions."
  ),
  "pde717-q5": revision(
    "Equity, safety, privacy, and evaluation",
    "A learning platform reports high log-in counts but no change in understanding and much higher teacher workload. What is the best conclusion?",
    "Usage alone does not establish value; compare learning, participation, workload, reliability, cost, and alternatives before continuing.",
    [
      "High log-in counts prove that every learner achieved the objective.",
      "Prior investment is sufficient reason to retain the platform indefinitely.",
      "Teacher workload and unequal access are unrelated to educational quality.",
    ],
    "Evaluation should examine intended learning and material consequences, not equate activity metrics with effectiveness."
  ),
  "pde718-q1": revision(
    "Planning as an evidence-informed prediction",
    "A planned digital demonstration cannot run because electricity fails. Which preparation best preserves the lesson's conceptual goal?",
    "Use a pre-planned non-digital representation that exposes the same relationship and collect the same intended evidence.",
    [
      "Cancel all learning because the original activity was the objective.",
      "Fill the period with unrelated copying so the timetable remains occupied.",
      "Replace the concept with an easier objective without examining alternatives.",
    ],
    "Contingency planning distinguishes the learning purpose from one delivery method and protects coherence under real conditions."
  ),
  "pde718-q5": revision(
    "Reflecting on evidence and improving the next lesson",
    "Which portfolio entry provides the strongest evidence of professional growth?",
    "A plan, de-identified learner evidence, focused feedback, a justified revision, and results from trying the change again.",
    [
      "A polished lesson plan with no evidence that it was taught or revised.",
      "A statement that the lesson felt successful without learner evidence.",
      "A collection of certificates unrelated to the selected practice target.",
    ],
    "Growth is demonstrated through a traceable cycle of evidence, feedback, changed action, and reviewed outcome."
  ),
  "pde719-q1": revision(
    "Defining a bounded educational problem",
    "A four-week project asks, 'How can every educational problem worldwide be solved?' Which revision is most defensible?",
    "Specify one evidence-supported problem, setting, participant group, timeframe, and feasible contribution.",
    [
      "Keep the scope and add more unrelated objectives.",
      "Begin collecting convenient data before defining the question.",
      "Remove limitations so the final conclusion can apply everywhere.",
    ],
    "A rigorous bounded project is more credible and useful than an unmanageable promise unsupported by its design."
  ),
  "pde719-q5": revision(
    "Managing process, ethics, and communication",
    "A presentation uses identifiable learner records even though aggregate findings answer the project question. What should the researcher do?",
    "Remove unnecessary identifiers, present the aggregate evidence, and retain sensitive data only under the approved secure plan.",
    [
      "Display the records because authentic evidence overrides confidentiality.",
      "Add photographs and contact details to make the sample memorable.",
      "Abandon every finding because privacy and dissemination can never coexist.",
    ],
    "Data minimisation and safe communication allow useful findings to be shared without exposing participants unnecessarily."
  ),
  "pde720-q1": revision(
    "Constructing a fair basis for comparison",
    "A report compares one country's national completion rate with another country's highest-performing private school. What is the first methodological correction?",
    "Define comparable units, populations, periods, indicators, and data sources before interpreting the difference.",
    [
      "Keep the mismatch because every percentage has the same denominator.",
      "Rank the countries using whichever case produces the largest contrast.",
      "Ignore differences in definitions as long as both sources use numbers.",
    ],
    "Comparison requires an explicit frame and equivalent units rather than treating unlike cases as naturally commensurable."
  ),
  "pde720-q5": revision(
    "Learning from elsewhere without copying blindly",
    "A ministry wants to copy a prestigious tutoring policy. Which question should be answered before choosing its visible programme format?",
    "What mechanism produced benefit, which conditions supported it, and how do those conditions compare with the local problem and capacity?",
    [
      "How quickly can the foreign programme name be adopted without translation?",
      "Which contextual evidence can be removed from the evaluation?",
      "How can implementation proceed without a pilot or stakeholder knowledge?",
    ],
    "Responsible borrowing identifies the active mechanism and tests local fit, feasibility, equity, and adaptation needs."
  ),
  "pde721-q1": revision(
    "Adult learners, experience, and participation",
    "An adult learner uses a reliable mental method from trading but hesitates with formal written notation. What is the strongest teaching response?",
    "Elicit and value the existing strategy, connect it explicitly to the formal representation, and provide purposeful supported practice.",
    [
      "Dismiss the strategy because learning outside school has no educational value.",
      "Assume experience means the learner needs no explanation or feedback.",
      "Remove numeracy from the programme to protect the learner's dignity.",
    ],
    "Adult experience is a resource that can be examined and connected to new transferable knowledge without lowering expectations."
  ),
  "pde721-q5": revision(
    "Flexible delivery, evidence of quality, and sustainability",
    "A programme has high enrolment but participants cannot use the targeted health-literacy skill outside sessions. What should evaluation conclude?",
    "Reach is strong, but evidence of capability and transfer is weak, so the learning design and conditions need investigation.",
    [
      "Enrolment proves that every intended outcome was achieved.",
      "Daily-life application is irrelevant to a non-formal programme.",
      "Flexible delivery requires no standards or evidence of learning.",
    ],
    "Participation is an output; quality also requires demonstrated learning, application, equity, and sustainable delivery."
  ),
  "pde722-q1": revision(
    "Turning workplace experience into deliberate learning",
    "An intern completes many routine hours but receives no goals, modelling, feedback, or increasing responsibility. What is missing?",
    "A structured learning agreement that connects supervised opportunities, standards, evidence, review, and gradual release.",
    [
      "A larger hour total, because duration alone demonstrates professional competence.",
      "Immediate unsupervised responsibility for every workplace task.",
      "A portfolio containing only attendance signatures.",
    ],
    "Workplace participation becomes professional learning through deliberate goals, supported practice, feedback, evidence, and growing responsibility."
  ),
  "pde722-q5": revision(
    "Building a portfolio of contribution and growth",
    "Which portfolio item best protects privacy while demonstrating development?",
    "A de-identified work sample linked to context, feedback, revision, outcome, and the professional standard addressed.",
    [
      "Identifiable learner records uploaded publicly to prove authenticity.",
      "A final artefact with no explanation of the intern's role or learning.",
      "A list of hours presented as proof of every professional standard.",
    ],
    "Strong portfolio evidence is authorised, privacy-safe, contextualised, and traceable through feedback and changed practice."
  ),
};

module.exports = { QUESTION_REVISIONS };
