import http from 'k6/http';
import { check } from 'k6';

const baseUrl = __ENV.TARGET_URL || 'http://host.docker.internal:8083';
const query = __ENV.QUERY || '/api/v1/exercise/list?page=1&page_size=20';

export const options = {
  vus: Number(__ENV.VUS || 20),
  duration: __ENV.DURATION || '5m',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1200'],
  },
};

export default function () {
  const res = http.get(`${baseUrl}${query}`);
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response has code 200': (r) => r.body && r.body.includes('"code":200'),
  });
}
