import React from 'react'
import { Button } from '../Button/Button'
import classes from './ReferalLinksItem.module.css'
import copy from '../../img/copy.svg'
import {CopyToClipboard} from 'react-copy-to-clipboard';
interface ReferalLinksItemProps {
    refCode: ReferralCode
}


export const ReferalLinksItem: React.FC<ReferalLinksItemProps> = ({refCode}) => {
    const linkValue = `https://raidbull.io/?r=${refCode.code}`

    // const earned = refCode.totalEarned.toFixed(3)
    const incomeValue = `${refCode.totalEarned} SOL`
    const [copiedLinkActive ,setCopiedLinkactive] = React.useState(false)
    const [copiedCodeActive ,setCopiedCodeActive] = React.useState(false)
    const isCopiedCodeActive = copiedCodeActive ? `${classes.copied} ${classes.copiedCode_active}` :  `${classes.copied} `
    const isCopiedLinkActive = copiedLinkActive ? `${classes.copied} ${classes.copiedLink_active}` :  `${classes.copied} `

    const linkCopy = () => {
        setCopiedLinkactive(true)
        setTimeout(() =>  setCopiedLinkactive(false),4000)
    }
    const codeCopy = () => {
        setCopiedCodeActive(true)
        setTimeout(() =>  setCopiedCodeActive(false),4000)
    }
    return (
        <div className={classes.ReferalLinksItemWrapper}>
            <div className={classes.ReferalLinksItemDataWrapper}>
                <div className={classes.ReferalLinksItemBlock}>
                    <div className={classes.ReferalLinksItemHeader}>
                        <div>Link</div> 
                        <div className={isCopiedLinkActive}>Copied!</div>
                    </div>
                    <div className={classes.ReferalLinksItemLinkValue}>
                        {linkValue}
                        <CopyToClipboard text={linkValue}
                                onCopy={() => linkValue}>
                                    <button className={classes.ReferalLinksItemCopyButton}><img src={copy} alt="" onClick={() => linkCopy()}/></button>
                        </CopyToClipboard>
                    </div>
                </div>
                <div className={classes.codeAndIncomeBlock}>
                    <div className={classes.ReferalLinksCodeBlock}>
                        <div className={classes.ReferalLinksItemHeader}>
                            <div>Code</div> 
                            <div className={isCopiedCodeActive}>Copied!</div>
                        </div>
                        <div className={classes.ReferalLinksItemCodeValue}>
                            {refCode.code}
                            <CopyToClipboard text={refCode.code}
                                onCopy={() => refCode.code}>
                                    <button className={classes.ReferalLinksItemCopyButton}><img src={copy} alt="" onClick={() => codeCopy()}/></button>
                            </CopyToClipboard>
                            
                        </div>
                    </div>
                    <div className={classes.ReferalLinksIncomeBlock}>
                        <div className={classes.ReferalLinksItemHeader}>
                            Income
                        </div>
                        <div className={classes.ReferalLinksItemIncomeValue}>
                            {incomeValue}
                        </div>
                    </div>
                </div>
            </div>
            <div className={classes.ReferalLinksItemButtonWrapper}>
                <Button color={'White'}>Statistics</Button>
                <Button color={'Red'}>Delete</Button>
            </div>
        </div>
    )
}
