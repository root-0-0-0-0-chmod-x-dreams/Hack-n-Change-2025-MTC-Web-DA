// tableService.js - API integration for table data
export class TableService {
  constructor(apiToken) {
    this.apiToken = apiToken;
    this.baseURL = 'https://tables.mws.ru/fusion/v1';
    this.datasheetId = 'dstjG1N3uvLFeF64X9';
  }

  async fetchRecords(options = {}) {
    const {
      viewId = 'viwaiHmHTClHK',
      pageNum = 1,
      pageSize = 100,
      fieldKey = 'name',
      fields = null,
      sort = null,
      filterByFormula = null,
      maxRecords = null,
      cellFormat = 'json'
    } = options;

    // Построение URL с параметрами
    const params = new URLSearchParams({
      viewId,
      pageNum: pageNum.toString(),
      pageSize: pageSize.toString(),
      fieldKey,
      cellFormat
    });

    if (fields && fields.length > 0) {
      fields.forEach(field => params.append('fields', field));
    }
    if (sort) {
      params.append('sort', JSON.stringify(sort));
    }
    if (filterByFormula) {
      params.append('filterByFormula', filterByFormula);
    }
    if (maxRecords) {
      params.append('maxRecords', maxRecords.toString());
    }

    try {
      const response = await fetch(
        `${this.baseURL}/datasheets/${this.datasheetId}/records?${params.toString()}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Table API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching table data:', error);
      throw error;
    }
  }

  // Форматирование данных таблицы для отправки в LLM
  formatRecordsForLLM(records) {
    if (!records || records.length === 0) {
      return 'Данные таблицы пусты.';
    }

    let formatted = 'Данные из таблицы:\n\n';
    records.forEach((record, index) => {
      formatted += `Запись ${index + 1}:\n`;
      Object.entries(record.fields).forEach(([key, value]) => {
        formatted += `- ${key}: ${value}\n`;
      });
      formatted += '\n';
    });

    return formatted;
  }
}
