import { Product } from "./Product";

const serverUrl = "http://localhost:5000";
let allProducts: Product[] = [];
let filteredProducts: Product[] = [];
let displayedProducts: Product[] = [];
let currentPage = 1;
const productsPerPage = 6;
let totalProductsOnServer = 0;
let cartCount = 0;

interface Filters {
  colors: string[];
  sizes: string[];
  priceRanges: string[];
  sortBy: string;
}

let currentFilters: Filters = {
  colors: [],
  sizes: [],
  priceRanges: [],
  sortBy: 'relevance'
};

async function getProducts(page: number = 1, limit: number = productsPerPage): Promise<{products: Product[], total: number}> {
  try {
    const response = await fetch(`${serverUrl}/products?_page=${page}&_limit=${limit}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const products: Product[] = await response.json();
    
    const totalCount = response.headers.get('X-Total-Count');
    const total = totalCount ? parseInt(totalCount, 10) : products.length;
    
    const uniqueProducts = products.filter((product, index, self) => 
      index === self.findIndex(p => p.id === product.id)
    );
    
    return { products: uniqueProducts, total };
  } catch (error) {
    console.error('Erro ao carregar os produtos:', error);
    throw error;
  }
}

function filterProducts(products: Product[]): Product[] {
  let filtered = [...products];

  if (currentFilters.colors.length > 0) {
    filtered = filtered.filter(product => 
      currentFilters.colors.includes(product.color)
    );
  }

  if (currentFilters.sizes.length > 0) {
    filtered = filtered.filter(product => 
      product.size.some(size => currentFilters.sizes.includes(size))
    );
  }

  if (currentFilters.priceRanges.length > 0) {
    filtered = filtered.filter(product => {
      return currentFilters.priceRanges.some(range => {
        switch (range) {
          case '0-50':
            return product.price >= 0 && product.price <= 50;
          case '51-150':
            return product.price >= 51 && product.price <= 150;
          case '151-300':
            return product.price >= 151 && product.price <= 300;
          case '301-500':
            return product.price >= 301 && product.price <= 500;
          case '500+':
            return product.price >= 500;
          default:
            return true;
        }
      });
    });
  }

  switch (currentFilters.sortBy) {
    case 'price-asc':
      filtered.sort((a, b) => a.price - b.price);
      break;
    case 'price-desc':
      filtered.sort((a, b) => b.price - a.price);
      break;
    case 'name':
      filtered.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'newest':
      filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      break;
    default:
      break;
  }

  return filtered;
}

function updateFilters(): void {
  const colorCheckboxes = document.querySelectorAll('input[name="color"]:checked') as NodeListOf<HTMLInputElement>;
  currentFilters.colors = Array.from(colorCheckboxes).map(color => color.value);

  const sizeCheckboxes = document.querySelectorAll('input[name="size"]:checked') as NodeListOf<HTMLInputElement>;
  currentFilters.sizes = Array.from(sizeCheckboxes).map(size => size.value);

  const priceCheckboxes = document.querySelectorAll('input[name="price"]:checked') as NodeListOf<HTMLInputElement>;
  currentFilters.priceRanges = Array.from(priceCheckboxes).map(price => price.value);

  const sortSelect = document.getElementById('sort-select') as HTMLSelectElement;
  if (sortSelect) {
    currentFilters.sortBy = sortSelect.value;
  }

  filteredProducts = filterProducts(allProducts);
  
  const maxDisplayed = currentPage * productsPerPage;
  displayedProducts = filteredProducts.slice(0, maxDisplayed);
  
  lastUniqueProductCount = displayedProducts.length;
  noNewUniqueProductsCount = 0;
  
  renderProducts(displayedProducts);
  updateLoadMoreButton();
}

async function loadMoreProducts(): Promise<void> {
  try {
    const loadMoreBtn = document.getElementById('load-more-btn') as HTMLButtonElement;
    if (loadMoreBtn) {
      loadMoreBtn.textContent = 'CARREGANDO...';
      loadMoreBtn.disabled = true;
    }

    const previousUniqueCount = allProducts.length;

    currentPage++;
    
    const { products: newProducts, total } = await getProducts(currentPage);
    totalProductsOnServer = total;
    
    const existingProductIds = new Set(allProducts.map(p => p.id));
    const actuallyNewProducts = newProducts.filter(product => !existingProductIds.has(product.id));
    
    allProducts = [...allProducts, ...actuallyNewProducts];
    
    lastUniqueProductCount = previousUniqueCount;
    
    filteredProducts = filterProducts(allProducts);
    
    const maxDisplayed = currentPage * productsPerPage;
    displayedProducts = filteredProducts.slice(0, maxDisplayed);
    
    renderProducts(displayedProducts);
    
    updateLoadMoreButton();
  } catch (error) {
    console.error('Erro ao carregar mais produtos:', error);
    
    const loadMoreBtn = document.getElementById('load-more-btn') as HTMLButtonElement;
    if (loadMoreBtn) {
      loadMoreBtn.textContent = 'CARREGAR MAIS';
      loadMoreBtn.disabled = false;
    }
  }
}

function updateLoadMoreButton(): void {
  const loadMoreBtn = document.getElementById('load-more-btn') as HTMLButtonElement;
  if (loadMoreBtn) {
    loadMoreBtn.textContent = 'CARREGAR MAIS';
    loadMoreBtn.disabled = false;
    
    const hasMoreProductsOnServer = allProducts.length < totalProductsOnServer;
    
    const shouldShowButton = hasMoreProductsOnServer && !hasReachedUniqueLimit();
    
    loadMoreBtn.style.display = shouldShowButton ? 'block' : 'none';
  }
}

let lastUniqueProductCount = 0;
let noNewUniqueProductsCount = 0;

function hasReachedUniqueLimit(): boolean {
  const currentUniqueCount = allProducts.length;
  
  if (currentUniqueCount === lastUniqueProductCount) {
    noNewUniqueProductsCount++;
    return noNewUniqueProductsCount >= 2;
  } else {
    noNewUniqueProductsCount = 0;
    lastUniqueProductCount = currentUniqueCount;
    return false;
  }
}

function initializeFilters(): void {
  const filterCheckboxes = document.querySelectorAll('input[type="checkbox"]');
  filterCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', updateFilters);
  });

  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', updateFilters);
  }

  initializeMobileSortOptions();
}

function initializeMobileSortOptions(): void {
  const mobileSortOptions = document.querySelectorAll('.mobile-sort-option');
  const realSortSelect = document.getElementById('sort-select') as HTMLSelectElement;
  
  if (!realSortSelect) return;

  mobileSortOptions.forEach(option => {
    option.addEventListener('click', () => {
      const value = option.getAttribute('data-value');
      
      if (value) {
        realSortSelect.value = value;
        
        const changeEvent = new Event('change', { bubbles: true });
        realSortSelect.dispatchEvent(changeEvent);
        
        const hiddenSelect = document.getElementById('hidden-select');
        if (hiddenSelect) {
          hiddenSelect.classList.remove('active');
        }
      }
    });
  });
}

function toggleAllColors(): void {
  const button = document.querySelector('.show-more') as HTMLButtonElement;
  const colorFilters = document.getElementById('color-filters');
  
  if (colorFilters && button) {
    const isExpanded = colorFilters.classList.contains('expanded');
    
    if (isExpanded) {
      colorFilters.classList.remove('expanded');
      button.innerHTML = '<span>Ver todas as cores</span><svg xmlns="http://www.w3.org/2000/svg" width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 1L4.5 6L8 1.00519" stroke="#666666" stroke-linecap="round"/></svg>';
    } else {
      colorFilters.classList.add('expanded');
      button.innerHTML = '<span>Ver menos cores</span><svg xmlns="http://www.w3.org/2000/svg" style="transform: rotate(180deg);" width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 1L4.5 6L8 1.00519" stroke="#666666" stroke-linecap="round"/></svg>';
    }
  }
}

function renderProducts(products: Product[]): void {
  const container = document.getElementById('products-container');
  if (!container) {
    console.error('Products container not found');
    return;
  }

  container.innerHTML = '';

  if (products.length === 0) {
    container.innerHTML = '<p class="no-products">Nenhum produto encontrado com os filtros selecionados.</p>';
    return;
  }

  products.forEach(product => {
    const productElement = createProductElement(product);
    container.appendChild(productElement);
  });
}

function appendProducts(products: Product[]): void {
  const container = document.getElementById('products-container');
  if (!container) {
    console.error('Products container not found');
    return;
  }

  products.forEach(product => {
    const productElement = createProductElement(product);
    container.appendChild(productElement);
  });
}

function createProductElement(product: Product): HTMLElement {
  const productCard = document.createElement('div');
  productCard.className = 'product-card';
  const [parcelas, valorParcela] = product.parcelamento;
  
  productCard.innerHTML = `
    <div class="product-image">
      <img src="${product.image}" alt="${product.name}" loading="lazy" />
    </div>
    <div class="product-info">
      <h3 class="product-name">${product.name.toUpperCase()}</h3>
      <div class="product-pricing">
        <span class="best-price">R$ ${product.price.toFixed(2).replace('.', ',')}</span>
        <span class="installment">até ${parcelas}x de R$ ${valorParcela.toFixed(2).replace('.', ',')}</span>
      </div>
      <button class="buy-button" onclick="buyProduct('${product.name}')">COMPRAR</button>
    </div>
  `;
  
  return productCard;
}

function buyProduct(productName: string): void {
  cartCount++;
  updateCartCount();
  localStorage.setItem('cartCount', cartCount.toString());
  
  alert(`Produto ${productName} adicionado ao carrinho!`);
}

function updateCartCount(): void {
  const cartCountElement = document.getElementById('cart-count');
  if (cartCountElement) {
    cartCountElement.textContent = cartCount.toString();
  }
}

function loadCartCount(): void {
  const savedCartCount = localStorage.getItem('cartCount');
  if (savedCartCount) {
    cartCount = parseInt(savedCartCount, 10) || 0;
  }
  updateCartCount();
}

function clearCart(): void {
  cartCount = 0;
  updateCartCount();
  localStorage.setItem('cartCount', '0');
}

function initializeCartButton(): void {
  const cartButton = document.getElementById('cart-button');
  if (cartButton) {
    cartButton.addEventListener('click', () => {
      if (cartCount > 0) {
        alert(`Você tem ${cartCount} item${cartCount > 1 ? 's' : ''} no carrinho!`);
      } else {
        alert('Seu carrinho está vazio.');
      }
    });
  }
}

function openFiltersSidebar(): void {
  const sidebar = document.getElementById('filters-sidebar');
  const openBtn = document.getElementById('open-filter');
  const closeBtn = document.getElementById('close-filter');

  if (sidebar && openBtn && closeBtn) {
    openBtn.addEventListener('click', () => {
      sidebar.classList.toggle('active');
    });

    closeBtn.addEventListener('click', () => {
      sidebar.classList.remove('active');
    });
  }
}

function openFiltersSorting(): void {
  const sortSelect = document.getElementById('sort-select');
  const openSortBtn = document.getElementById('open-sorting');
  const closeSortBtn = document.getElementById('close-sorting');

  const sortOptions = document.getElementById('hidden-select');

  if (sortSelect && sortOptions) {
    openSortBtn.addEventListener('click', () => {
      sortOptions.classList.toggle('active');
    });

    closeSortBtn.addEventListener('click', () => {
      sortOptions.classList.toggle('active');
    });
  }
}

async function main() {
  const container = document.getElementById('products-container');
  if (container) {
    container.innerHTML = '<p class="loading">Carregando produtos...</p>';
  }

  loadCartCount();
  
  try {
    const { products: initialProducts, total } = await getProducts(1);
    allProducts = initialProducts;
    totalProductsOnServer = total;

    lastUniqueProductCount = allProducts.length;
    noNewUniqueProductsCount = 0;
    
    if (!allProducts || allProducts.length === 0) {
      throw new Error('Nenhum produto disponível');
    }
    
    filteredProducts = [...allProducts];
    displayedProducts = filteredProducts.slice(0, productsPerPage);
    
    initializeFilters();
    
    renderProducts(displayedProducts);
    updateLoadMoreButton();
    openFiltersSidebar();
    openFiltersSorting();
    initializeCartButton();
  } catch (error) {
    console.error('Falha ao carregar produtos:', error);
    
    if (container) {
      container.innerHTML = '<p class="error">Erro ao carregar produtos 👀</p>';
    }
    
    allProducts = [];
    filteredProducts = [];
    displayedProducts = [];
    totalProductsOnServer = 0;
    lastUniqueProductCount = 0;
    noNewUniqueProductsCount = 0;
    
    initializeFilters();
    updateLoadMoreButton();
  }
}

function toggleAccordion(sectionName: string): void {
  const content = document.querySelector(`[data-accordion="${sectionName}"]`) as HTMLElement;
  const header = content?.previousElementSibling as HTMLElement;
  
  if (!content || !header) return;

  const isExpanded = content.classList.contains('expanded');
  
  if (isExpanded) {
    content.classList.remove('expanded');
    header.classList.remove('active');
  } else {
    content.classList.add('expanded');
    header.classList.add('active');
  }
}

(window as any).buyProduct = buyProduct;
(window as any).toggleAllColors = toggleAllColors;
(window as any).loadMoreProducts = loadMoreProducts;
(window as any).toggleAccordion = toggleAccordion;
(window as any).clearCart = clearCart;

document.addEventListener("DOMContentLoaded", main);
