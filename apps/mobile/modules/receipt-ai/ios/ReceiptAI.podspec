Pod::Spec.new do |s|
  s.name           = 'ReceiptAI'
  s.version        = '1.0.0'
  s.summary        = 'On-device LLM receipt parsing'
  s.description    = 'Apple Foundation Models (iOS 26+) receipt parsing for My Receipt Book'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '16.4'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  # FoundationModels only exists on iOS 26+; weak-link so the app still launches on 16.4+.
  s.weak_frameworks = 'FoundationModels'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
