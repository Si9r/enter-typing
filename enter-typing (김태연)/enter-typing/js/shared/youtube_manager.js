/**
 * YouTube IFrame API 로딩 및 초기화를 전담하는 공통 모듈입니다.
 * 여러 페이지(타이핑/퀴즈/대전)가 각자 window.onYouTubeIframeAPIReady를 덮어쓰며 생기던
 * 레이스 컨디션을 없애기 위해, API 로드는 한 번만 수행하고 플레이어 생성 요청은
 * 준비가 끝날 때까지 대기시킨 뒤 순서대로 처리합니다.
 */
window.YouTubeManager = (function () {
  const IFRAME_API_SRC = "https://www.youtube.com/iframe_api";
  let apiReadyPromise = null;

  function ensureApiLoaded() {
    if (apiReadyPromise) return apiReadyPromise;

    apiReadyPromise = new Promise((resolve) => {
      if (window.YT && window.YT.Player) {
        resolve(window.YT);
        return;
      }

      const previousCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = function () {
        if (typeof previousCallback === "function") previousCallback();
        resolve(window.YT);
      };

      const alreadyRequested = document.querySelector(
        `script[src="${IFRAME_API_SRC}"]`,
      );
      if (!alreadyRequested) {
        const tag = document.createElement("script");
        tag.src = IFRAME_API_SRC;
        const firstScriptTag = document.getElementsByTagName("script")[0];
        if (firstScriptTag && firstScriptTag.parentNode) {
          firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        } else {
          document.head.appendChild(tag);
        }
      }
    });

    return apiReadyPromise;
  }

  /**
   * API 로드를 기다린 뒤 YT.Player 인스턴스를 생성해 반환하는 Promise를 돌려줍니다.
   */
  function createPlayer(elementId, options) {
    return ensureApiLoaded().then((YT) => new YT.Player(elementId, options));
  }

  function onReady(callback) {
    return ensureApiLoaded().then(callback);
  }

  return { ensureApiLoaded, createPlayer, onReady };
})();
