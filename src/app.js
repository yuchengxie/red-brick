// app.js

import env from "env";

let rootChart = null;

window.addEventListener('DOMContentLoaded', (ev) => {
  (window.LRS || {})._noToolbar = true;
},false);

window.addEventListener('resize', (ev) => {
  if (rootChart) {
    const wd = parseInt(document.body.clientWidth * 0.94);
    const hi = parseInt(document.body.clientHeight * 0.94);
    rootChart.resize({width:wd,height:hi,silent:false});
  }
},false);

window.addEventListener('load', (ev) => {
  let cfg = LRS._sendSync({command:'loadAppCfg'});  // loadAppCfg should be success
  if (!cfg || !cfg.data) {
    console.log('fatal error: read config failed');
    return;
  }
  cfg = cfg.data;
  const graph = {nodes:cfg.nodes, links:cfg.links};
  
  rootChart = echarts.init(document.getElementById('menu-chart'));
  rootChart.hideLoading();
  
  graph.nodes.forEach( (node) => {
    node.itemStyle = null;
    node.symbolSize = node.size * 1.8;
    node.x = node.y = null;  // use random x, y
    node.draggable = true;
  });
  
  const option = {
    title: { show: false },
    tooltip: {
      formatter: (params, ticket, callback) => {
        let desc = params.data.url || '';
        if (desc.length > 20) desc = desc.slice(0,18) + '...';
        return `${params.data.name} ${desc}`
      }
    },
    legend: [ {
      // selectedMode: 'single',
      data: cfg.categories.map( (a) => {
        return a.name;
      })
    }],
    animation: true,
    series : [ {
      name: '',
      type: 'graph',
      layout: 'force',
      data: graph.nodes,
      links: graph.links,
      categories: cfg.categories,
      roam: 'move',
      label: {
        normal: {
          show: true,
          fontSize: 13,
          position: 'inside'
        }
      },
      slient: false,
      force: {
        repulsion: 300
      }
    }]
  };
  rootChart.setOption(option);
  
  rootChart.on('click', 'series.graph', (ev) => {
    const data = ev.data;  // ev.event.preventDefault()
    console.log('rootChart url:',data.url);
    if (data.url) {
      LRS._sendAsyn({command:'newWindow',url:data.url,isRootApp:true});
    }
  });
},false);
