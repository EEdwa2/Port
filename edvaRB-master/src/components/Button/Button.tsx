import React from 'react'
import classes from './Button.module.css'

interface ButtonProps extends React.ComponentPropsWithRef<"button">{
    color?: "White" | "Red" | 'Yellow' | 'Red'
    text?: string
    size?: string
    icon?:any
    
}

export const Button: React.FC<ButtonProps> = ({children, color}) => {

    const className=`${classes.button} ${classes[`button${color}`]}` 
    
    return (
        <button className={className}>
            {children}
        </button>
    )
}
