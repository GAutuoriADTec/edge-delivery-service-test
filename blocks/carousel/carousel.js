import { createOptimizedPicture } from '../../scripts/aem.js';

const AUTOPLAY_DELAY = 6000;

/**
 * Replaces the raw <img> in an image cell with an optimized picture.
 * @param {Element} imageDiv The cell containing the authored image
 * @param {boolean} eager Whether to load the image eagerly
 */
function optimizeSlideImage(imageDiv, eager) {
  const img = imageDiv.querySelector('img');
  if (!img) return;
  const picture = createOptimizedPicture(img.src, img.alt, eager, [{ width: '750' }]);
  (img.closest('picture') || img).replaceWith(picture);
}

/**
 * Builds a single slide <li> from an authored row.
 * @param {Element} row The authored row (image cell + content cell)
 * @param {number} index The slide index
 * @returns {Element} The slide list item
 */
function buildSlide(row, index) {
  const li = document.createElement('li');
  li.className = 'carousel-slide';
  li.id = `carousel-slide-${index}`;
  li.dataset.slideIndex = index;
  li.setAttribute('role', 'group');
  li.setAttribute('aria-roledescription', 'slide');
  li.setAttribute('aria-label', `${index + 1}`);

  const [imageDiv, contentDiv] = row.children;

  if (imageDiv) {
    imageDiv.className = 'carousel-slide-image';
    optimizeSlideImage(imageDiv, index === 0);
    li.append(imageDiv);
  }

  if (contentDiv) {
    contentDiv.className = 'carousel-slide-content';
    li.append(contentDiv);
  }

  return li;
}

/**
 * Updates slide visibility, dots and track position for the active index.
 * @param {Element} block The carousel block
 * @param {number} index The slide index to activate
 */
function updateActiveSlide(block, index) {
  const slides = block.querySelectorAll('.carousel-slide');
  const dots = block.querySelectorAll('.carousel-dot');
  const track = block.querySelector('.carousel-slides-list');

  slides.forEach((slide, i) => {
    const isActive = i === index;
    slide.setAttribute('aria-hidden', !isActive);
    slide.querySelectorAll('a, button').forEach((el) => {
      if (isActive) el.removeAttribute('tabindex');
      else el.setAttribute('tabindex', '-1');
    });
  });

  dots.forEach((dot, i) => {
    const isActive = i === index;
    dot.classList.toggle('active', isActive);
    dot.setAttribute('aria-selected', isActive);
  });

  if (track) track.style.transform = `translateX(-${index * 100}%)`;
  block.dataset.activeSlide = index;
}

/**
 * Shows the slide at the given index, wrapping around the ends.
 * @param {Element} block The carousel block
 * @param {number} index The requested slide index
 */
function showSlide(block, index) {
  const slides = block.querySelectorAll('.carousel-slide');
  if (!slides.length) return;
  const newIndex = ((index % slides.length) + slides.length) % slides.length;
  updateActiveSlide(block, newIndex);
}

/**
 * Stops the autoplay interval for the carousel, if running.
 * @param {Element} block The carousel block
 */
function stopAutoplay(block) {
  if (block.dataset.autoplayId) {
    window.clearInterval(parseInt(block.dataset.autoplayId, 10));
    delete block.dataset.autoplayId;
  }
}

/**
 * Starts autoplay, advancing to the next slide on a timer.
 * Respects reduced-motion preference and does nothing for single-slide carousels.
 * @param {Element} block The carousel block
 */
function startAutoplay(block) {
  stopAutoplay(block);
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (block.querySelectorAll('.carousel-slide').length < 2) return;
  block.dataset.autoplayId = window.setInterval(() => {
    const current = parseInt(block.dataset.activeSlide, 10) || 0;
    showSlide(block, current + 1);
  }, AUTOPLAY_DELAY);
}

/**
 * Wires up navigation, keyboard, hover/focus and touch interactions.
 * @param {Element} block The carousel block
 * @param {Element} prevButton The previous-slide button
 * @param {Element} nextButton The next-slide button
 * @param {Element} dotsWrapper The dots navigation container
 */
function bindEvents(block, prevButton, nextButton, dotsWrapper) {
  const goTo = (index) => {
    showSlide(block, index);
    startAutoplay(block);
  };

  prevButton.addEventListener('click', () => goTo((parseInt(block.dataset.activeSlide, 10) || 0) - 1));
  nextButton.addEventListener('click', () => goTo((parseInt(block.dataset.activeSlide, 10) || 0) + 1));

  dotsWrapper.addEventListener('click', (e) => {
    const dot = e.target.closest('.carousel-dot');
    if (dot) goTo(parseInt(dot.dataset.index, 10));
  });

  block.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') goTo((parseInt(block.dataset.activeSlide, 10) || 0) - 1);
    else if (e.key === 'ArrowRight') goTo((parseInt(block.dataset.activeSlide, 10) || 0) + 1);
  });

  block.addEventListener('mouseenter', () => stopAutoplay(block));
  block.addEventListener('mouseleave', () => startAutoplay(block));
  block.addEventListener('focusin', () => stopAutoplay(block));
  block.addEventListener('focusout', () => startAutoplay(block));

  const track = block.querySelector('.carousel-slides-list');
  let touchStartX = 0;
  track.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    stopAutoplay(block);
  }, { passive: true });
  track.addEventListener('touchend', (e) => {
    const delta = e.changedTouches[0].clientX - touchStartX;
    const current = parseInt(block.dataset.activeSlide, 10) || 0;
    if (delta > 40) goTo(current - 1);
    else if (delta < -40) goTo(current + 1);
    else startAutoplay(block);
  }, { passive: true });
}

/**
 * loads and decorates the carousel block
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const rows = [...block.children];

  // rows with a single cell are used to author custom prev/next arrow content;
  // rows with two cells (image + text) are the actual slides
  const controlRows = rows.filter((row) => row.children.length === 1);
  const slideRows = rows.filter((row) => row.children.length >= 2);

  const nextContent = controlRows[0];
  const prevContent = controlRows.length > 1 ? controlRows[controlRows.length - 1] : null;

  const list = document.createElement('ul');
  list.className = 'carousel-slides-list';
  slideRows.forEach((row, index) => list.append(buildSlide(row, index)));

  const slidesWrapper = document.createElement('div');
  slidesWrapper.className = 'carousel-slides';
  slidesWrapper.setAttribute('role', 'region');
  slidesWrapper.setAttribute('aria-roledescription', 'carousel');
  slidesWrapper.append(list);

  const prevButton = document.createElement('button');
  prevButton.type = 'button';
  prevButton.className = 'carousel-arrow carousel-arrow-prev';
  prevButton.setAttribute('aria-label', 'Previous slide');
  prevButton.innerHTML = prevContent ? prevContent.innerHTML : '&#10094;';

  const nextButton = document.createElement('button');
  nextButton.type = 'button';
  nextButton.className = 'carousel-arrow carousel-arrow-next';
  nextButton.setAttribute('aria-label', 'Next slide');
  nextButton.innerHTML = nextContent ? nextContent.innerHTML : '&#10095;';

  const dotsWrapper = document.createElement('div');
  dotsWrapper.className = 'carousel-dots';
  dotsWrapper.setAttribute('role', 'tablist');
  slideRows.forEach((row, index) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'carousel-dot';
    dot.dataset.index = index;
    dot.setAttribute('role', 'tab');
    dot.setAttribute('aria-label', `Slide ${index + 1}`);
    dot.setAttribute('aria-controls', `carousel-slide-${index}`);
    dotsWrapper.append(dot);
  });

  block.textContent = '';
  block.append(slidesWrapper, prevButton, nextButton, dotsWrapper);
  if (slideRows.length < 2) {
    prevButton.hidden = true;
    nextButton.hidden = true;
    dotsWrapper.hidden = true;
  }
  block.setAttribute('tabindex', '0');

  bindEvents(block, prevButton, nextButton, dotsWrapper);
  showSlide(block, 0);
  startAutoplay(block);
}
