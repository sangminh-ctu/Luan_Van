<template>
  <div class="container-fluid bg-light py-3">
    <div class="container">
      


      <!-- 1. HERO BANNER -->
      <div class="row mb-4">
        <div class="col-12">
          <div id="mainBanner" class="carousel slide rounded-3 overflow-hidden shadow-sm" data-bs-ride="carousel" data-bs-interval="3000">
            <!-- Dáº¥u cháº¥m chá»‰ má»¥c -->
            <div class="carousel-indicators">
              <button type="button" data-bs-target="#mainBanner" data-bs-slide-to="0" class="active"></button>
              <button type="button" data-bs-target="#mainBanner" data-bs-slide-to="1"></button>
              <button type="button" data-bs-target="#mainBanner" data-bs-slide-to="2"></button>
              <button type="button" data-bs-target="#mainBanner" data-bs-slide-to="3"></button>
            </div>
            
            <!-- HÃ¬nh áº£nh -->
            <div class="carousel-inner">
              <div class="carousel-item active"><img src="../../assets/images/banners/banner1.jpg" class="d-block w-100" style="height: 350px; object-fit: cover;"></div>
              <div class="carousel-item"><img src="../../assets/images/banners/banner2.png" class="d-block w-100" style="height: 350px; object-fit: cover;"></div>
              <div class="carousel-item"><img src="../../assets/images/banners/banner3.jpg" class="d-block w-100" style="height: 350px; object-fit: cover;"></div>
              <div class="carousel-item"><img src="../../assets/images/banners/banner4.png" class="d-block w-100" style="height: 350px; object-fit: cover;"></div>
            </div>

            <!-- NÃºt báº¥m lÃ¹i/tá»›i -->
            <button class="carousel-control-prev" type="button" data-bs-target="#mainBanner" data-bs-slide="prev">
              <span class="carousel-control-prev-icon" aria-hidden="true"></span>
              <span class="visually-hidden">Previous</span>
            </button>
            <button class="carousel-control-next" type="button" data-bs-target="#mainBanner" data-bs-slide="next">
              <span class="carousel-control-next-icon" aria-hidden="true"></span>
              <span class="visually-hidden">Next</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 2. FLASH SALE -->
      <div class="bg-white rounded-3 shadow-sm p-3 mb-4">
        <div class="d-flex align-items-center mb-3">
          <h3 class="text-danger fw-bold mb-0 me-3">ðŸ”¥ FLASH SALE</h3>
          <div class="bg-dark text-white px-2 py-1 rounded me-1">02</div>:
          <div class="bg-dark text-white px-2 py-1 rounded mx-1">45</div>:
          <div class="bg-dark text-white px-2 py-1 rounded ms-1">10</div>
          <a href="#" class="ms-auto text-primary text-decoration-none">Xem táº¥t cáº£ ></a>
        </div>
        <div class="row row-cols-2 row-cols-md-3 row-cols-lg-6 g-3">
          <div class="col" v-for="book in books" :key="book.book_id">
            <div class="card h-100 border-0 book-card cursor-pointer">
              <div class="position-relative">
                <img :src="book.cover" class="card-img-top rounded" :alt="book.title" style="object-fit: cover; aspect-ratio: 3/4;">
                <span class="badge bg-danger position-absolute top-0 end-0 m-1">-{{ book.discount_percent }}%</span>
              </div>
              <div class="card-body p-2 d-flex flex-column">
                <h6 class="card-title text-truncate" style="font-size: 14px;" :title="book.title">{{ book.title }}</h6>
                <div class="mt-auto">
                  <div class="text-danger fw-bold mb-1">{{ book.price.toLocaleString('vi-VN') }} Ä‘</div>
                  <div class="progress" style="height: 18px;">
                    <div class="progress-bar bg-danger" role="progressbar" :style="{ width: book.sold + '%' }">
                      ÄÃ£ bÃ¡n {{ book.sold }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 3. DANH Má»¤C Sáº¢N PHáº¨M -->
      <div class="bg-white rounded-3 shadow-sm p-3 mb-4">
        <h5 class="fw-bold mb-3">DANH Má»¤C Sáº¢N PHáº¨M</h5>
        <div class="row row-cols-4 row-cols-lg-8 g-3 text-center">
          <div class="col cursor-pointer category-item" v-for="(cat, index) in categories" :key="index">
            <div class="bg-light rounded-circle mx-auto mb-2 d-flex align-items-center justify-content-center" style="width: 80px; height: 80px;">
              <span class="fs-2">{{ cat.icon }}</span>
            </div>
            <div style="font-size: 13px;">{{ cat.name }}</div>
          </div>
        </div>
      </div>

      <!-- 4. XU HÆ¯á»šNG MUA Sáº®M -->
      <div class="bg-white rounded-3 shadow-sm overflow-hidden mb-5">
        <!-- Header mÃ u há»“ng nháº¡t -->
        <div class="d-flex align-items-center p-3" style="background-color: #FCE4EC;">
          <div class="bg-danger text-white p-2 rounded me-2 d-flex align-items-center justify-content-center" style="width: 40px; height: 40px;">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" class="bi bi-graph-up-arrow" viewBox="0 0 16 16">
              <path fill-rule="evenodd" d="M0 0h1v15h15v1H0V0Zm10 3.5a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-1 0V4.9l-3.613 4.417a.5.5 0 0 1-.74.037L7.06 6.767l-3.656 5.027a.5.5 0 0 1-.808-.588l4-5.5a.5.5 0 0 1 .758-.06l2.609 2.61L13.445 4H10.5a.5.5 0 0 1-.5-.5Z"/>
            </svg>
          </div>
          <h4 class="mb-0 fw-bold">Xu HÆ°á»›ng Mua Sáº¯m</h4>
        </div>

        <!-- Tabs -->
        <div class="d-flex px-3 pt-3 border-bottom" style="gap: 30px;">
          <div class="cursor-pointer pb-2 trend-tab" :class="{ 'active': activeTab === 'bestseller' }" @click="activeTab = 'bestseller'">Bestseller Ngoáº¡i VÄƒn</div>
          <div class="cursor-pointer pb-2 trend-tab" :class="{ 'active': activeTab === 'manga' }" @click="activeTab = 'manga'">Manga - Bestseller</div>
          <div class="cursor-pointer pb-2 trend-tab" :class="{ 'active': activeTab === 'foreign' }" @click="activeTab = 'foreign'">Foreign Books - BÃ¡n Cháº¡y Nháº¥t</div>
        </div>

        <!-- Grid Sáº£n Pháº©m Xu HÆ°á»›ng -->
        <div class="p-3 bg-light">
          <div class="row row-cols-2 row-cols-md-3 row-cols-lg-5 g-3">
            <div class="col" v-for="book in booksTrend" :key="book.book_id">
              <div class="card h-100 border-0 shadow-sm trend-card cursor-pointer position-relative">
                
                <div v-if="book.isPreorder" class="position-absolute top-0 start-0 m-2 px-2 py-1 bg-info text-white rounded" style="font-size: 11px; z-index: 2;">Sáº¯p CÃ³ HÃ ng</div>
                <div v-if="book.volume" class="position-absolute m-2 px-2 py-1 bg-dark text-white rounded" style="font-size: 11px; z-index: 2; bottom: 40%; right: 0;">{{ book.volume }}</div>

                <div class="p-2 text-center" style="height: 220px;">
                  <img :src="book.cover" class="h-100 w-100 rounded" :alt="book.title" style="object-fit: cover;">
                </div>
                
                <div class="card-body p-3 d-flex flex-column bg-white">
                  <h6 class="card-title text-truncate mb-2" style="font-size: 14px;" :title="book.title">{{ book.title }}</h6>
                  
                  <div class="mt-auto">
                    <div class="d-flex align-items-center mb-1">
                      <span class="text-danger fw-bold fs-5 me-2">{{ book.price.toLocaleString('vi-VN') }} Ä‘</span>
                      <span class="badge bg-danger">-{{ book.discount_percent }}%</span>
                    </div>
                    <div class="text-muted text-decoration-line-through" style="font-size: 13px;">{{ Math.round(book.price / (1 - book.discount_percent/100)).toLocaleString('vi-VN') }} Ä‘</div>
                    
                    <div class="d-flex align-items-center mt-2" style="font-size: 12px; color: #f5a623;">
                      <span v-if="book.rating">â˜…â˜…â˜…â˜…â˜… ({{ book.rating_count }}) | </span>
                      <span class="text-muted ms-1">ÄÃ£ bÃ¡n {{ book.sold }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="text-center mt-4 mb-2">
            <button class="btn btn-outline-danger px-5 py-2 fw-bold" style="border-radius: 8px;">Xem ThÃªm</button>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const activeTab = ref('bestseller');

// MOCK DATA: 6 Cuá»‘n sÃ¡ch cho Flash Sale
const books = ref([
  { book_id: 1, title: 'MuÃ´n Kiáº¿p NhÃ¢n Sinh', price: 143000, discount_percent: 35, cover: 'https://via.placeholder.com/200x280/FCE4EC/c92127?text=Muon+Kiep', sold: 85 },
  { book_id: 2, title: 'CÃ¢y Cam Ngá»t Cá»§a TÃ´i', price: 64800, discount_percent: 40, cover: 'https://via.placeholder.com/200x280/FFF3E0/e65100?text=Cay+Cam', sold: 92 },
  { book_id: 3, title: 'NhÃ  Giáº£ Kim (TÃ¡i báº£n)', price: 53700, discount_percent: 32, cover: 'https://via.placeholder.com/200x280/FFF8E1/f57f17?text=Nha+Gia+Kim', sold: 60 },
  { book_id: 4, title: 'NgÆ°á»i GiÃ u CÃ³ Nháº¥t ThÃ nh Babylon', price: 53900, discount_percent: 45, cover: 'https://via.placeholder.com/200x280/E3F2FD/1565c0?text=Babylon', sold: 78 },
  { book_id: 5, title: 'Äáº¯c NhÃ¢n TÃ¢m', price: 54500, discount_percent: 38, cover: 'https://via.placeholder.com/200x280/E8F5E9/2e7d32?text=Dac+Nhan+Tam', sold: 88 },
  { book_id: 6, title: 'NghÄ© GiÃ u VÃ  LÃ m GiÃ u', price: 82000, discount_percent: 25, cover: 'https://via.placeholder.com/200x280/F3E5F5/4a148c?text=Nghi+Giau', sold: 45 }
]);

// MOCK DATA: Xu HÆ°á»›ng Mua Sáº¯m (Ngoáº¡i VÄƒn)
const booksTrend = ref([
  { book_id: 11, title: 'Rich Dad Poor Dad', price: 236000, discount_percent: 15, cover: 'https://via.placeholder.com/200x280/ECEFF1/37474F?text=Rich+Dad', sold: 533, rating: 5, rating_count: 4, isPreorder: false, volume: '' },
  { book_id: 12, title: 'Project Hail Mary', price: 350000, discount_percent: 10, cover: 'https://via.placeholder.com/200x280/E8EAF6/3F51B5?text=Project+Hail', sold: 120, rating: 5, rating_count: 12, isPreorder: true, volume: '' },
  { book_id: 13, title: 'Moby Dick (Wordsworth)', price: 85000, discount_percent: 20, cover: 'https://via.placeholder.com/200x280/EFEBE9/5D4037?text=Moby+Dick', sold: 45, rating: 4, rating_count: 2, isPreorder: false, volume: 'Táº­p 7' },
  { book_id: 14, title: 'Atomic Habits', price: 420000, discount_percent: 5, cover: 'https://via.placeholder.com/200x280/FFFDE7/F57F17?text=Atomic+Habits', sold: 999, rating: 5, rating_count: 340, isPreorder: false, volume: '' },
  { book_id: 15, title: 'The Psychology of Money', price: 380000, discount_percent: 12, cover: 'https://via.placeholder.com/200x280/E0F2F1/00695C?text=Psychology', sold: 850, rating: 5, rating_count: 215, isPreorder: false, volume: '' }
]);

// MOCK DATA: Danh má»¥c
const categories = ref([
  { name: 'SÃ¡ch GiÃ¡o Khoa', icon: 'ðŸ“š' },
  { name: 'Truyá»‡n Tranh', icon: 'ðŸ¦¸' },
  { name: 'Tiá»ƒu Thuyáº¿t', icon: 'ðŸ“–' },
  { name: 'SÃ¡ch Kinh Táº¿', icon: 'ðŸ“ˆ' },
  { name: 'TÃ¢m LÃ½ Há»c', icon: 'ðŸ§ ' },
  { name: 'SÃ¡ch Thiáº¿u Nhi', icon: 'ðŸ§¸' },
  { name: 'VÄƒn Há»c NÆ°á»›c NgoÃ i', icon: 'ðŸŒ' },
  { name: 'VÄƒn PhÃ²ng Pháº©m', icon: 'âœï¸' }
]);
</script>

<style scoped>
.book-card:hover, .trend-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 .5rem 1rem rgba(0,0,0,.15)!important;
  transition: all 0.2s ease-in-out;
}
.cursor-pointer {
  cursor: pointer;
}
.category-item:hover .bg-light {
  background-color: #f8d7da!important;
  color: #c92127;
  transition: all 0.2s;
}

.trend-tab {
  font-size: 15px;
  font-weight: 500;
  color: #555;
}
.trend-tab.active {
  color: #c92127;
  font-weight: bold;
  border-bottom: 2px solid #c92127;
}
.trend-tab:hover:not(.active) {
  color: #c92127;
}
</style>

