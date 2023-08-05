import React from 'react';
import styles from './App.module.css'
import { RaidBull } from './components/RaidBull/RaidBull';
import { ReferalLinks } from './components/ReferalLinks/ReferalLinks';
import { Statistics } from './components/Statistics/Statistics';


// const DEFAULT_LINK_LIST: = [
//   { link: 'https://raidbull.io/?r=h3gFh32A', code: 'x4S56dd8', income: '3.3400 $KING'},
//   { link: 'https://raidbull.io/?r=h3gFh32A', code: 'x4S56d55', income: '2.3400 $KING'},
// ];

function App() {
  return (
    <div className={styles.appWrapper}>
      {/*<RaidBull/>*/}
      <div className={styles.mainPartWrapper}>
        <ReferalLinks/>
        <Statistics/>
      </div>

    </div>
  );
}

export default App;
