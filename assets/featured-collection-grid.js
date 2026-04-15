if (!customElements.get('featured-collection-grid')) {
  class FeaturedCollectionGrid extends HTMLElement {
    constructor() {
      super();

      this.wishlistStorageKey = 'featured_collection_wishlist';

      this.onChipClick = this.onChipClick.bind(this);
      this.onSwatchClick = this.onSwatchClick.bind(this);
      this.onBlockSelect = this.onBlockSelect.bind(this);

      this.onQuickAddClick = this.onQuickAddClick.bind(this);
      this.onWishlistClick = this.onWishlistClick.bind(this);
    }

    connectedCallback() {
      this.chips = [...this.querySelectorAll('[data-filter-chip]')];
      this.columns = [...this.querySelectorAll('.product-card__column')];
      this.emptyState = this.querySelector('[data-empty-state]');

      this.bindEvents();
      this.syncWishlistButtons();
      this.applyInitialFilter();
    }

    disconnectedCallback() {
      this.unbindEvents();
    }

    bindEvents() {
      this.chips.forEach((chip) => {
        chip.addEventListener('click', this.onChipClick);
      });

      this.querySelectorAll('.card').forEach((card) => {
        const swatches = card.querySelectorAll('.swatch');
        swatches.forEach((swatch) => {
          swatch.addEventListener('click', this.onSwatchClick);
        });
      });

      this.querySelectorAll('[data-quick-add]').forEach((button) => {
        button.addEventListener('click', this.onQuickAddClick);
      });

      this.querySelectorAll('[data-wishlist-button]').forEach((button) => {
        button.addEventListener('click', this.onWishlistClick);
      });

      document.addEventListener('shopify:block:select', this.onBlockSelect);
    }

    unbindEvents() {
      this.chips.forEach((chip) => {
        chip.removeEventListener('click', this.onChipClick);
      });

      this.querySelectorAll('.card').forEach((card) => {
        const swatches = card.querySelectorAll('.swatch');
        swatches.forEach((swatch) => {
          swatch.removeEventListener('click', this.onSwatchClick);
        });
      });

      this.querySelectorAll('[data-quick-add]').forEach((button) => {
        button.removeEventListener('click', this.onQuickAddClick);
      });

      this.querySelectorAll('[data-wishlist-button]').forEach((button) => {
        button.removeEventListener('click', this.onWishlistClick);
      });

      document.removeEventListener('shopify:block:select', this.onBlockSelect);
    }

    /* ---------------- Wishlist ---------------- */

    getWishlist() {
      try {
        const stored = localStorage.getItem(this.wishlistStorageKey);
        const parsed = stored ? JSON.parse(stored) : [];
        return Array.isArray(parsed) ? parsed : [];
      } catch (error) {
        console.error('Wishlist read failed:', error);
        return [];
      }
    }

    setWishlist(items) {
      try {
        localStorage.setItem(this.wishlistStorageKey, JSON.stringify(items));
      } catch (error) {
        console.error('Wishlist write failed:', error);
      }
    }

    syncWishlistButtons() {
      const wishlist = this.getWishlist();

      this.querySelectorAll('[data-wishlist-button]').forEach((button) => {
        const productId = String(button.dataset.productId || '');
        const isActive = wishlist.includes(productId);

        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });
    }

    addToWishlist(button) {
      const productId = String(button.dataset.productId || '');
      const productTitle = button.dataset.productTitle || 'Product';

      if (!productId) return false;

      const wishlist = this.getWishlist();

      if (wishlist.includes(productId)) {
        alert(`${productTitle} is already in your wishlist.`);
        return false;
      }

      wishlist.push(productId);
      this.setWishlist(wishlist);

      button.classList.add('is-active');
      button.setAttribute('aria-pressed', 'true');

      alert(`${productTitle} added to wishlist.`);
      return true;
    }

    onWishlistClick(event) {
      event.preventDefault();
      event.stopPropagation();
      this.addToWishlist(event.currentTarget);
    }

    /* ---------------- Quick Add ---------------- */

    onQuickAddClick(event) {
      this.quickAdd(event);
    }

    async quickAdd(event) {
      event.preventDefault();
      event.stopPropagation();

      const button = event.currentTarget;
      if (!button || button.disabled || button.hasAttribute('aria-disabled')) return false;

      const productId = button.dataset.productId;
      const productTitle = button.dataset.productTitle || 'Product';
      const quantity = Number(button.dataset.quantity || 1);

      if (!productId) return false;

      button.classList.add('loading');
      button.setAttribute('aria-disabled', 'true');
      button.disabled = true;

      try {
        const formData = new FormData();
        formData.append('id', productId);
        formData.append('quantity', quantity);

        const response = await fetch(theme.routes.cart_add_url, {
          method: 'POST',
          headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'Accept': 'application/json'
          },
          body: formData
        });

        const data = await response.json();

        if (!response.ok || data?.status) {
          console.error('Quick add failed:', data);
          alert('Ürün sepete eklenemedi.');
          return false;
        }

        alert(`${productTitle} eklendi. Adet: ${quantity}`);
      } catch (error) {
        console.error(error);
        alert('Bir hata oluştu.');
      } finally {
        button.classList.remove('loading');
        button.removeAttribute('aria-disabled');
        button.disabled = false;
      }

      return false;
    }

    /* ---------------- Filter ---------------- */

    onChipClick(event) {
      const chip = event.currentTarget;
      this.applyFilter(chip);
    }

    onSwatchClick(event) {
      this.updateSwatchImage(event.currentTarget);
    }

    updateSwatchImage(swatch) {
      const card = swatch.closest('.card');
      if (!card) return;

      const mainImage = card.querySelector('.card__images img');
      const swatches = card.querySelectorAll('.swatch');

      if (!mainImage || !swatches.length) return;

      swatches.forEach((item) => item.classList.remove('active'));
      swatch.classList.add('active');

      const newSrcset = swatch.dataset.srcset;
      if (!newSrcset) return;

      mainImage.setAttribute('srcset', newSrcset);

      const firstCandidate = newSrcset
        .split(',')
        .map((item) => item.trim())
        .find(Boolean);

      if (!firstCandidate) return;

      const newSrc = firstCandidate.split(' ')[0];
      if (newSrc) {
        mainImage.setAttribute('src', newSrc);
      }
    }

    onBlockSelect(event) {
      if (!this.contains(event.target)) return;

      const blockId = event.target.dataset.blockId;
      if (!blockId) return;

      const chip = this.querySelector(`[data-filter-chip][data-block-id="${blockId}"]`);
      if (!chip) return;

      this.applyFilter(chip);
    }

    applyInitialFilter() {
      const activeChip =
        this.querySelector('[data-filter-chip].is-active') ||
        this.chips[0];

      if (activeChip) {
        this.applyFilter(activeChip);
      }
    }

    applyFilter(selectedChip) {
      const selectedFilter = selectedChip?.dataset.filterValue || 'all';
      let visibleCount = 0;

      this.chips.forEach((chip) => {
        const isActive = chip === selectedChip;
        chip.classList.toggle('is-active', isActive);
        chip.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });

      this.columns.forEach((column) => {
        const card = column.querySelector('.card');
        if (!card) return;

        const filters = (card.dataset.filters || '')
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean);

        const shouldShow =
          selectedFilter === 'all' || filters.includes(selectedFilter);

        column.classList.toggle('is-hidden', !shouldShow);

        if (shouldShow) visibleCount++;
      });

      if (this.emptyState) {
        this.emptyState.classList.toggle('is-hidden', visibleCount > 0);
      }
    }
  }

  customElements.define('featured-collection-grid', FeaturedCollectionGrid);
}