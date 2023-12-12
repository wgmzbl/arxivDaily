<template>
  <div class="user-page">
    <div class="view-favor">
      <div class="title-type">My Favoriates</div>
      <div id="conent">
        <div v-for="paper in currentPapers" :key="paper.arxivId" class="paper entry" ref="content">
          <div class="entry-title">{{ paper.title }}</div>
          <div class="entry-title">{{ paper.arxivId }}</div>
          <div class="entry-author authors">{{ paper.authors }}</div>
          <div class="entry-comments">{{ paper.comments }}</div>
          <div class="entry-submitTime">{{ paper.submitTime }}</div>
          <div class="entry-summary">{{ paper.summary }}</div>
          <button @click="navigateTo(paper.url)"><i class="fa fa-file-pdf-o"></i></button>
          <button @click="deleteInteresting(paper.arxivId)"><i class="fa fa-trash"></i></button>
        </div>
        <div class="pagination-container">
          <button @click="prevPage" :disabled="currentPage <= 1"><i class="fa fa-arrow-left"
              aria-hidden="true"></i></button>

          <div class="page-info">
            <div class="current-page">Current Page: {{ currentPage }} / {{ maxPage }}</div>
            <div class="total-papers">Total Papers: {{ totalPapers }}</div>
          </div>

          <button @click="nextPage" :disabled="currentPage >= maxPage"><i class="fa fa-arrow-right"
              aria-hidden="true"></i></button>
        </div>
      </div>
    </div>
  </div>
</template>
  
<script>
import axios from 'axios';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import renderMathInElement from "katex/dist/contrib/auto-render.js";

export default {
  data() {
    return {
      paperIds: [],
      currentPapers: [],
      currentPage: 1,
      pageSize: 10,
    };
  },
  watch: {
    currentPapers() {
      try {
        this.$nextTick(() => {
          try {
            this.$refs.content.forEach((element) => {
              renderMathInElement(element, {
                delimiters: [
                  { left: "$$", right: "$$", display: true },
                  { left: "$", right: "$", display: false },
                  { left: "\\[", right: "\\]", display: true },
                  { left: "\\(", right: "\\)", display: false }
                ],
                throwOnError: false
              });
            });
          }
          catch (e) {
            console.error('Error rendering LaTeX:', e);
          }
        });
      } catch (e) {
        console.log(e);
      }
    }
  },
  computed: {
    totalPapers() {
      return this.paperIds.length;
    },
    maxPage() {
      return Math.ceil(this.totalPapers / this.pageSize);
    },
  },
  methods: {
    navigateTo(url) {
      window.open(url, '_blank');
    },
    renderLaTeX() {
      this.$nextTick(() => {
        if (this.$refs.content) {
          try {
            renderMathInElement(this.$refs.content, {
              delimiters: [
                { left: "$$", right: "$$", display: true },
                { left: "$", right: "$", display: false },
                { left: "\\[", right: "\\]", display: true },
                { left: "\\(", right: "\\)", display: false }
              ],
              throwOnError: false
            });
          } catch (e) {
            console.error('Error rendering LaTeX:', e);
          }
        } else {
          console.warn('Content reference not found.');
        }
      });
    },
    async fetchInteresting() {
      try {
        const response = await axios.post('/fetchInteresting');
        this.paperIds = response.data;
        this.fetchCurrentPagePapers();
      } catch (error) {
        console.error('Error fetching interesting papers:', error);
      }
    },
    async fetchCurrentPagePapers() {
      const start = (this.currentPage - 1) * this.pageSize;
      const currentIds = this.paperIds.slice(start, start + this.pageSize);
      try {
        let curPaper = [];
        for (const id of currentIds) {
          const response = await axios.post('/fetchPaperData', { id });
          curPaper.push(response.data);
        }
        this.currentPapers = curPaper;
      } catch (error) {
        console.error('Error fetching current page papers:', error);
      }
    },
    prevPage() {
      if (this.currentPage > 1) {
        this.currentPage--;
        this.fetchCurrentPagePapers();
      }
    },
    nextPage() {
      if (this.currentPage < this.maxPage) {
        this.currentPage++;
        this.fetchCurrentPagePapers();
      }
    },
    async deleteInteresting(id) {
      try {
        await axios.post('/deleteInteresting', { id });
        // Re-fetch the interesting papers list
        await this.fetchInteresting();
        // Adjust current page if on the last page and it's now empty
        if (this.currentPage === this.maxPage && this.currentPapers.length === 0 && this.currentPage > 1) {
          this.currentPage--;
        }
        this.fetchCurrentPagePapers();
      } catch (error) {
        console.error('Error deleting paper:', error);
      }
    },
  },
  mounted() {
    this.fetchInteresting();
  },
};
</script>
  
<style>
.pagination-container {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 20px;
}

.page-info {
  margin: 0 15px;
  text-align: center;
}

.current-page,
.total-papers {
  margin-bottom: 5px;
  font-size: 14px;
  color: #333;
}

button:disabled {
  background-color: #e0e0e0;
  cursor: not-allowed;
}
</style>
  