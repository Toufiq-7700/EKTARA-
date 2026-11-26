/**
 * Bengali (BN) translation dictionary for EKTARA (একতারা).
 * Technical algorithm names stay in Latin script alongside clear Bengali explanations.
 * Numbers stay in Latin digits. Lines marked `// TODO: review` are flagged for native review.
 * Keys must match src/i18n/en.js 100% (verified by tests/i18n.test.js).
 */
export default {
  app: {
    name: 'EKTARA',
    nativeName: 'একতারা',
    concept: 'একটি তার, একটি সূত্র, অসীম সুর।', // TODO: review
    tagline: 'একটি সূত্র, অসীম সুর',
    taglineSecondary: 'Where algorithms meet sound'
  },
  welcome: {
    subtitle: 'একটি তার, একটি সূত্র, অসীম সংগীত। চারটি রিকার্সিভ অ্যালগরিদম একটি বীজ থেকেই সুর, বেস, ছন্দ এবং জীবন্ত দৃশ্য বুনে তোলে।', // TODO: review
    begin: 'শুরু করুন',
    preparing: 'প্রস্তুত হচ্ছে...',
    headphones: '🎧 হেডফোন ব্যবহার করলে সবচেয়ে ভালো শোনা যাবে',
    soundHint: 'শব্দ মৃদুভাবে শুরু হবে',
    howItWorksLink: 'কিভাবে কাজ করে ↓',
    howItWorksTitle: 'কিভাবে কাজ করে',
    howItWorksOneLiner: 'একটি বীজ। চারটি রিকার্সিভ সূত্র। অসীম সংগীত।',
    cardNorgardTitle: 'Nørgård Infinity Series',
    cardNorgardDesc: 'এমন এক সুর যা নিজের ভেতরেই নিজেকে ধারণ করে',
    cardHanoiTitle: 'Tower of Hanoi',
    cardHanoiDesc: 'চাকতির চাল হয়ে ওঠে হৃদস্পন্দন',
    cardEuclidTitle: 'Euclidean Rhythm',
    cardEuclidDesc: 'সমান দূরত্বে ছড়ানো ছন্দের স্পন্দন',
    cardLsystemTitle: 'L-System',
    cardLsystemDesc: 'পুনর্লিখন সূত্রে বেড়ে ওঠা এক জীবন্ত গাছ',
    aboutNameBtn: 'নামটি সম্পর্কে',
    aboutNameTitle: 'কেন "EKTARA (একতারা)"?',
    aboutNameBodyEn: 'The Ektara (একতারা) is a traditional one-stringed folk instrument of Bengal. From a single string plucked with a simple rule, skilled bauls draw endless melodies — just as EKTARA weaves melody, bass, rhythm, and fractal growth from one recursive seed: "one string, one rule, infinite music."',
    aboutNameBodyBn: 'একতারা বাংলার ঐতিহ্যবাহী এক-তারের লোকবাদ্যযন্ত্র। একটি মাত্র তার ও সহজ নিয়ম থেকেই যেমন অসংখ্য সুরের জন্ম হয়, তেমনি EKTARA একটি বীজ ও চারটি রিকার্সিভ সূত্র থেকে অসীম সংগীত ও দৃশ্য তৈরি করে — "একটি তার, একটি সূত্র, অসীম সুর"।',
    closeBtn: 'বন্ধ করুন'
  },
  tour: {
    step1Title: 'অ্যালগরিদম কার্ড',
    step1Body: 'সুর, বেস, ছন্দ ও গাছের অ্যালগরিদম চালু/বন্ধ, একক (Solo) বা পরিবর্তন করুন এবং সরাসরি সিমুলেশন দেখুন।',
    step2Title: 'প্যারামিটার ড্রয়ার',
    step2Body: 'যেকোনো সময় ☰ নিয়ন্ত্রণ খুলে যন্ত্রের স্বর, বৃষ্টি, থিম, প্রিসেট এবং WAV অডিও এক্সপোর্ট করতে পারবেন।',
    step3Title: 'গভীরতার ডায়াল (Depth Dial)',
    step3Body: 'রিকার্সন গভীরতা বাড়িয়ে বা কমিয়ে চারটি অ্যালগরিদমের জটিলতা একসাথে নিয়ন্ত্রণ করুন।',
    step4Title: 'বাজানো যায় এমন একতারা তার',
    step4Body: 'এটি আপনার একতারা: সুরের সাথে তাল মিলিয়ে বাজাতে তারে টান দিন বা ক্লিক করুন।',
    next: 'পরবর্তী',
    done: 'বুঝেছি',
    skip: 'এড়িয়ে যান'
  },
  views: {
    garden: '🌳 বাগান',
    split: '◫ বিভক্ত',
    lab: '🔬 ল্যাব',
    controlsOpen: '☰ নিয়ন্ত্রণ'
  },
  status: {
    audioBlocked: 'ব্রাউজার অডিও আটকে দিয়েছে, তবে দৃশ্য চলছে।',
    audioRetryFailed: 'অডিও এখনও বন্ধ আছে — অনুগ্রহ করে ব্রাউজারের সাউন্ড অনুমতি পরীক্ষা করুন।',
    retryAudio: 'আবার চেষ্টা করুন'
  },
  controls: {
    panelTitle: 'একতারা · EKTARA',
    closePanel: 'নিয়ন্ত্রণ প্যানেল বন্ধ করুন',
    depthLabel: 'রিকার্সন গভীরতা (Depth)',
    depthHint: 'রিকার্সনের স্তর সংখ্যা — গভীরতা বাড়লে সুর ও গাছ আরও সমৃদ্ধ হয়',
    seedLabel: 'বীজ (Seed)',
    seedHint: 'একটি সংখ্যা যা প্রতিটি সংগীতকে অনন্য রূপ দেয়',
    randomSeedTitle: 'নতুন এলোমেলো বীজ!',
    scaleLabel: 'স্কেল / মুড',
    scaleHint: 'সুরের স্কেল — pentatonic শান্ত, আর lydian স্বপ্নময় আবহ আনে',
    rootNoteLabel: 'মূল স্বর (Root Note)',
    tempoLabel: 'তাল / গতি (Tempo)',
    tempoHint: 'সংগীতের গতি (BPM)',
    angleLabel: 'ডালের কোণ (Branch Angle)',
    angleHint: 'গাছের ডালপালা কতটা ছড়িয়ে পড়বে',
    densityLabel: 'ছন্দের ঘনত্ব',
    densityHint: 'প্রতি চক্রে কতগুলো তালের আঘাত বাজবে',
    treeShapeLabel: 'গাছের ধরন',
    themeLabel: 'রঙের থিম',
    qualityLabel: 'গ্রাফিক্স কোয়ালিটি',
    qualityAuto: 'অটো (প্রস্তাবিত)',
    qualityHigh: 'উচ্চ (High)',
    qualityBalanced: 'মাঝারি (Balanced)',
    qualityLite: 'হালকা (Lite)',
    ambientLabel: 'পরিবেশের শব্দ',
    ambientWind: 'বাতাস',
    ambientRain: 'বৃষ্টি',
    ambientNone: 'কিছুই না',
    rainIntensityLabel: 'বৃষ্টির তীব্রতা',
    rainIntensityHint: 'দৃশ্যের বৃষ্টি, পাতার ঝিলিক এবং বৃষ্টির শব্দ একসাথে নিয়ন্ত্রণ করে (0 = বন্ধ)',
    rainOff: 'বন্ধ',
    thunderLabel: 'দূরের মেঘগর্জন',
    thunderHint: '(শুধু ভারী বৃষ্টিতে)',
    recursionParamsTitle: 'রিকার্সন প্যারামিটার',
    recursionParamsHint: 'প্রতিটি ভূমিকায় অ্যালগরিদম ও প্যারামিটার বেছে নিন (ল্যাবের সাথে সরাসরি যুক্ত)',
    soundPanelTitle: 'সাউন্ড — যন্ত্রের টিম্বার',
    soundPanelHint: 'ভাইব্রাটো ও প্রাকৃতিক হিউম্যানাইজেশনসহ উষ্ণ যান্ত্রিক সুর', // TODO: review
    layerMelody: 'সুর (Melody)',
    layerCanon: 'ক্যানন (Canon)',
    layerBass: 'বেস (Bass)',
    layerPercussion: 'তাল (Percussion)',
    layerAmbient: 'অ্যাম্বিয়েন্ট প্যাড',
    layerDrone: 'একতারা ড্রোন',
    layerVolumesTitle: 'স্তরের ভলিউম',
    xrayLabel: 'এক্স-রে মোড',
    xrayHint: '(রিকার্সন কল দেখান)',
    evolveLabel: 'বিবর্তন (Evolve)',
    evolveHint: '(প্রতি চক্রে বীজ বদলায়)',
    sleepLabel: 'স্লিপ টাইমার',
    sleepOff: 'বন্ধ',
    sleep5: '5 মিনিট',
    sleep15: '15 মিনিট',
    sleep30: '30 মিনিট',
    zoomLabel: 'গাছের ভেতরে জুম',
    presetsLabel: 'প্রিসেট',
    shareBtn: '🔗 EKTARA শেয়ার লিংক কপি করুন',
    shareCopied: '✓ লিংক কপি হয়েছে!',
    explainerTitle: 'আপনি যা দেখছেন ও শুনছেন',
    explainerNorgard: 'Nørgård অসীম ধারা → সুর। একটি আত্ম-সদৃশ গাণিতিক ধারা যেখানে প্রতিটি মানের ভেতরে নিজেরই ছোট প্রতিলিপি লুকিয়ে থাকে।', // TODO: review
    explainerHanoi: 'হ্যানয়ের মিনার (Tower of Hanoi) → বেস। খুঁটির মধ্যে চাকতি সরানোর নিয়ম: বড় চাকতি মানে ধীর ও গভীর স্বর, ছোট চাকতি মানে দ্রুত স্বর।',
    explainerEuclid: 'Bjorklund ইউক্লিডীয় ছন্দ → তাল। এক চক্রের মধ্যে সমানভাবে আঘাত সাজিয়ে লোকসংগীতের মতো সহজাত ছন্দ তৈরি করে।',
    explainerLsystem: 'L-System → গাছ। অক্ষর বদলানোর নিয়মে ডালপালা বাড়ে এবং সুরের মান অনুযায়ী ডালের কোণ বদলে গাছই সুর হয়ে ওঠে।',
    explainerEktara: 'একতারা তার → ইন্টারঅ্যাক্টিভ ড্রোন। এটি আপনার একতারা: সুরের সাথে তাল মিলিয়ে বাজাতে তারে টান দিন।',
    exportTitle: 'সংগীত এক্সপোর্ট করুন',
    export30: '30 সেকেন্ড (+6s শেষ রেশ)',
    export60: '1 মিনিট (+6s শেষ রেশ)',
    export180: '3 মিনিট (+6s শেষ রেশ)',
    downloadWav: '⬇ WAV ডাউনলোড',
    exportJson: '📄 JSON',
    loadJson: '📂 লোড',
    exportStarting: 'অফলাইন রেন্ডার শুরু হচ্ছে...',
    exportSaved: '{filename} সংরক্ষিত হয়েছে',
    exportCancel: 'বাতিল',
    exportCancelled: 'এক্সপোর্ট বাতিল করা হয়েছে।',
    exportFailed: 'এক্সপোর্ট ব্যর্থ হয়েছে — ছোট সময় বেছে নিয়ে আবার চেষ্টা করুন।',
    exportJsonError: 'JSON প্যারামিটার এক্সপোর্ট করা যায়নি।',
    loadJsonSuccess: '{filename} লোড হয়েছে',
    loadJsonError: 'সঠিক JSON প্যারামিটার ফাইল নয়।'
  },
  presets: {
    'Quiet Forest': 'শান্ত বন',
    'Moonlit Pond': 'জ্যোৎস্না পুকুর',
    'Deep Dream': 'গভীর স্বপ্ন',
    'Morning Light': 'ভোরের আলো'
  },
  roles: {
    melody: 'সুর (Melody)',
    bass: 'বেস (Bass)',
    rhythm: 'ছন্দ (Rhythm)',
    tree: 'গাছ (Visual Tree)'
  },
  algorithms: {
    norgard: {
      name: 'Nørgård Infinity Series',
      desc: 'Nørgård অসীম ধারা — প্রতিটি সুরের ভেতরে নিজেরই ছোট প্রতিলিপি থাকে।'
    },
    'thue-morse': {
      name: 'Thue-Morse Sequence',
      desc: 'Thue-Morse ধারা (t(2n)=t(n), t(2n+1)=1-t(n)) — একঘেয়ে পুনরাবৃত্তি এড়িয়ে চলে।'
    },
    'fibonacci-word': {
      name: 'Fibonacci Word',
      desc: 'Fibonacci শব্দ (S_n = S_(n-1) + S_(n-2)) — সোনালি অনুপাতের ছন্দময় সুর তৈরি করে।' // TODO: review
    },
    hanoi: {
      name: 'Tower of Hanoi',
      desc: 'হ্যানয়ের মিনার (Tower of Hanoi) — তিন খুঁটিতে চাকতি সরিয়ে গভীর বেস ও দৈর্ঘ্য নির্ধারণ করে।'
    },
    'gray-code': {
      name: 'Recursive Gray Code',
      desc: 'Gray কোড — প্রতিফলন ও প্রিফিক্সের মাধ্যমে একবারে মাত্র একটি বিট বদলে বেস বাজায়।' // TODO: review
    },
    'cantor-bass': {
      name: 'Cantor Set Bass',
      desc: 'Cantor সেট — মাঝের এক-তৃতীয়াংশ বাদ দিয়ে নীরবতা ও গভীর বেস তৈরি করে।'
    },
    bjorklund: {
      name: 'Euclidean (Bjorklund)',
      desc: 'Bjorklund ইউক্লিডীয় ছন্দ — সমান দূরত্বে তালের আঘাত সাজায়।'
    },
    'cantor-rhythm': {
      name: 'Cantor Set Pattern',
      desc: 'Cantor সেট ছন্দ — মাঝের ফাঁকা অংশ শান্ত ও ধ্যানমগ্ন বিরতি আনে।'
    },
    'thue-morse-rhythm': {
      name: 'Thue-Morse Pattern',
      desc: 'Thue-Morse ছন্দ — 0 এবং 1-এর বিকল্প ধারায় মৃদু ব্রাশ ও চাইম বাজায়।'
    },
    lsystem: {
      name: 'L-System Tree',
      desc: 'L-System — নিয়ম মেনে ডালপালা বাড়ে এবং সুরের সাথে কোণ মিলিয়ে গাছ আঁকে।'
    },
    'koch-curve': {
      name: 'Koch Curve',
      desc: 'Koch বক্ররেখা — প্রতিটি সরলরেখা চার ভাগে ভেঙে তুষারকণার মতো রেখা আঁকে।'
    },
    'sierpinski-triangle': {
      name: 'Sierpinski Triangle',
      desc: 'Sierpinski ত্রিভুজ — পারস্পরিক রিকার্সিভ নিয়মে ত্রিভুজাকার জ্যামিতি তৈরি করে।'
    }
  },
  lab: {
    solo: 'একক',
    parameters: 'প্যারামিটার',
    play: '▶ চালান',
    pause: '⏸ বিরতি',
    stepBack: '⏮ ধাপ',
    stepFwd: '⏭ ধাপ',
    replay: '↺ শুরু থেকে',
    speed: 'গতি',
    scrubGen: 'প্রজন্ম দেখুন',
    captionDefault: 'সরাসরি চলছে — যেকোনো কার্ড বেছে নিন বা "ধাপ" চাপুন।',
    captionResumed: 'সরাসরি প্লেব্যাক আবার চলছে।',
    captionReplay: 'শুরু থেকে আবার বাজছে।',
    whatYouHear: 'আপনি যা শুনছেন — সম্মিলিত রিকার্সিভ স্তর',
    whatYouHearHint: 'বাগানে চিহ্নিত করতে হোভার করুন · ধাপে যেতে ক্লিক করুন',
    resetBtn: '↺ রিসেট',
    randomBtn: '🎲 এলোমেলো'
  }
};
