name: AI Model Contribution
description: Automated workflow for AI models to contribute code
labels: [ai-contribution, automated]

inputs:
  ai_model:
    description: 'Which AI model is contributing? (grok, chatgpt, claude, etc.)'
    required: true
    type: choice
    options:
      - grok
      - chatgpt
      - claude
      - other

  feature_type:
    description: 'Type of feature or fix'
    required: true
    type: choice
    options:
      - feature
      - enhancement
      - bugfix
      - documentation
      - integration

  title:
    description: 'PR Title'
    required: true
    type: string

  description:
    description: 'Detailed description of changes'
    required: true
    type: string
