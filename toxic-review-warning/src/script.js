const url = new URL('./worker.js', import.meta.url);
import { MESSAGE_CODE, MODEL_STATUS } from './consts.js';
import { TYPING_DELAY } from './config.js';

// Initialization

let modelStatus = MODEL_STATUS.NOT_STARTED;
let isToxicityVisible = false;
updateToxicityVisibility(isToxicityVisible);
displayModelStatus(modelStatus);
updateToxicityAssessmentDisplay({ isToxic: false, toxicityTypeList: [] });
const worker = new Worker(url);
let typingTimeout = 0;

// DOM manipulation, display and events

function updateToxicityVisibility(isVisible) {
  isToxicityVisible = isVisible;
  document.getElementById('aiWrapper').className = isToxicityVisible
    ? 'visible'
    : 'hidden';
}

function handleUserInputChange(event) {
  if (isToxicityVisible) {
    updateToxicityVisibility(false);
  }
  if (typingTimeout) {
    clearTimeout(typingTimeout);
  }
  typingTimeout = setTimeout(() => {
    console.info('Input: User has stopped typing');
    if (modelStatus === MODEL_STATUS.READY) {
      console.info('Trigger inference');
      runLLMInference();
    }
    setTimeout(() => {}, 1000);
  }, TYPING_DELAY);
}

function updateUiByModelStatus(status) {
  displayModelStatus(status);
  displayAiEffectStatus(status);
}

function displayAiEffectStatus(status) {
  document.getElementById('aiEffect').className = status;
}

function displayModelStatus(status) {
  document.getElementById('modelStatusWrapper').className = status;
  document.getElementById('modelStatus').className = status;
}

function updateToxicityAssessmentDisplay(output) {
  const { isToxic, toxicityTypeList } = output;
  document.getElementById('toxicityAssessmentEl').innerText = isToxic
    ? 'Your comment may be hurtful. Please consider revising it.'
    : '';
}

function simulatePostReview() {
  document.getElementById('reviewInputEl').value = '';
  updateToxicityVisibility(false);
  window.alert('Review posted!');
}

// Gen AI / Inference + Worker message handling

function runLLMInference() {
  const userPrompt = document.getElementById('reviewInputEl').value.trim();
  if (!userPrompt) {
    return;
  }
  worker.postMessage(userPrompt);
}

worker.onmessage = function (message) {
  console.info('[Main thread] 📬 Message from worker: ', message);

  if (!message.data || !message.data.code) {
    throw new Error(
      `Message from worker is empty or doesn't contain a code field: ${message}`
    );
  }
  const messageCode = message.data.code;
  switch (messageCode) {
    case MESSAGE_CODE.PREPARING_MODEL:
      modelStatus = MODEL_STATUS.PREPARING;
      updateUiByModelStatus(modelStatus);
      break;

    case MESSAGE_CODE.MODEL_READY:
      modelStatus = MODEL_STATUS.READY;
      updateUiByModelStatus(modelStatus);
      runLLMInference();
      break;

    case MESSAGE_CODE.GENERATING_RESPONSE:
      modelStatus = MODEL_STATUS.GENERATING;
      updateUiByModelStatus(modelStatus);
      updateToxicityAssessmentDisplay('');
      break;

    case MESSAGE_CODE.RESPONSE_READY:
      // TODO change to "ready again" to diff from first-time READY state?
      modelStatus = MODEL_STATUS.READY;
      updateUiByModelStatus(modelStatus);
      updateToxicityAssessmentDisplay(message.data.payload);
      if (message.data.payload.isToxic) {
        updateToxicityVisibility(true);
      }
      break;

    case MESSAGE_CODE.MODEL_ERROR:
      modelStatus = MODEL_STATUS.ERROR;
      updateUiByModelStatus(modelStatus);
      break;

    case MESSAGE_CODE.INFERENCE_ERROR:
      // TODO Display feedback to the user
      break;

    default:
      throw new Error(
        `Message from worker contains an unknown message code: ${messageCode}`
      );
  }
};

window.runLLMInference = runLLMInference;
window.simulatePostReview = simulatePostReview;
window.handleUserInputChange = handleUserInputChange;
